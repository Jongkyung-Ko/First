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
      ["402340.KS", "SK스퀘어"],
      ["009150.KS", "삼성전기"],
      ["005380.KS", "현대차"],
      ["373220.KS", "LG에너지솔루션"],
      ["032830.KS", "삼성생명"],
      ["028260.KS", "삼성물산"],
      ["329180.KS", "HD현대중공업"],
      ["034020.KS", "두산에너빌리티"],
      ["000270.KS", "기아"],
      ["207940.KS", "삼성바이오로직스"],
      ["012450.KS", "한화에어로스페이스"],
      ["105560.KS", "KB금융"],
      ["012330.KS", "현대모비스"],
      ["034730.KS", "SK"],
      ["055550.KS", "신한지주"],
      ["006400.KS", "삼성SDI"],
      ["042660.KS", "한화오션"],
      ["267260.KS", "HD현대일렉트릭"],
      ["068270.KS", "셀트리온"],
      ["010120.KS", "LS ELECTRIC"],
      ["035420.KS", "NAVER"],
      ["066570.KS", "LG전자"],
      ["298040.KS", "효성중공업"],
      ["086790.KS", "하나금융지주"],
      ["009540.KS", "HD한국조선해양"],
      ["005490.KS", "POSCO홀딩스"],
      ["042700.KS", "한미반도체"],
      ["000810.KS", "삼성화재"]
    ],
    kr_kosdaq: [
      ["196170.KQ", "알테오젠"],
      ["247540.KQ", "에코프로비엠"],
      ["277810.KQ", "레인보우로보틱스"],
      ["036930.KQ", "주성엔지니어링"],
      ["240810.KQ", "원익IPS"],
      ["028300.KQ", "HLB"],
      ["058470.KQ", "리노공업"],
      ["141080.KQ", "레고켐바이오"],
      ["298380.KQ", "에이비엘바이오"],
      ["039030.KQ", "이오테크닉스"],
      ["319660.KQ", "PSK"],
      ["000250.KQ", "삼천당제약"],
      ["403870.KQ", "HPSP"],
      ["222800.KQ", "심텍"],
      ["440110.KQ", "파두"],
      ["022100.KQ", "포스코DX"],
      ["036630.KQ", "세종텔레콤"],
      ["084370.KQ", "유진테크"],
      ["214450.KQ", "파마리서치"],
      ["095610.KQ", "테스"],
      ["226950.KQ", "올릭스"],
      ["178320.KQ", "서진시스템"],
      ["108490.KQ", "로보티즈"],
      ["064760.KQ", "티씨케이"],
      ["087010.KQ", "펩트론"],
      ["145020.KQ", "휴젤"],
      ["005290.KQ", "동진쎄미켐"],
      ["066970.KQ", "엘앤에프"],
      ["080220.KQ", "제주반도체"],
      ["357780.KQ", "솔브레인"]
    ],
    nyse: [
      ["TSM", "TSMC"],
      ["LLY", "Eli Lilly"],
      ["BRK-B", "Berkshire Hathaway"],
      ["JPM", "JPMorgan Chase"],
      ["V", "Visa"],
      ["JNJ", "Johnson & Johnson"],
      ["XOM", "Exxon Mobil"],
      ["CAT", "Caterpillar"],
      ["MA", "Mastercard"],
      ["ABBV", "AbbVie"],
      ["ORCL", "Oracle"],
      ["BAC", "Bank of America"],
      ["GE", "GE Aerospace"],
      ["UNH", "UnitedHealth"],
      ["KO", "Coca-Cola"],
      ["HD", "Home Depot"],
      ["PG", "Procter & Gamble"],
      ["MS", "Morgan Stanley"],
      ["CVX", "Chevron"],
      ["HSBC", "HSBC"],
      ["MRK", "Merck"],
      ["GS", "Goldman Sachs"],
      ["GEV", "GE Vernova"],
      ["AZN", "AstraZeneca"],
      ["NVS", "Novartis"],
      ["RY", "Royal Bank of Canada"],
      ["PM", "Philip Morris"],
      ["DELL", "Dell Technologies"],
      ["IBM", "IBM"],
      ["WFC", "Wells Fargo"]
    ],
    nasdaq: [
      ["NVDA", "NVIDIA"],
      ["GOOGL", "Alphabet A"],
      ["GOOG", "Alphabet C"],
      ["AAPL", "Apple"],
      ["MSFT", "Microsoft"],
      ["AMZN", "Amazon"],
      ["AVGO", "Broadcom"],
      ["TSLA", "Tesla"],
      ["META", "Meta"],
      ["MU", "Micron"],
      ["AMD", "AMD"],
      ["WMT", "Walmart"],
      ["INTC", "Intel"],
      ["ASML", "ASML"],
      ["AMAT", "Applied Materials"],
      ["LRCX", "Lam Research"],
      ["CSCO", "Cisco"],
      ["COST", "Costco"],
      ["KLAC", "KLA"],
      ["ARM", "Arm Holdings"],
      ["NFLX", "Netflix"],
      ["PLTR", "Palantir"],
      ["PANW", "Palo Alto Networks"],
      ["TXN", "Texas Instruments"],
      ["MRVL", "Marvell"],
      ["LIN", "Linde"],
      ["WDC", "Western Digital"],
      ["STX", "Seagate"],
      ["QCOM", "Qualcomm"],
      ["CRWD", "CrowdStrike"]
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
    { id: "6mo", label: "6M" },
    { id: "1y", label: "1Y" },
    { id: "2y", label: "2Y" },
    { id: "5y", label: "5Y" },
    { id: "10y", label: "10Y" }
  ];
  const DEFAULT_CHART_PERIOD = "6mo";
  const CHART_INTERVAL = "1d";
  const CHART_PAGE_INITIAL = 10;
  const CHART_PAGE_STEP = 10;
  const CHART_SNAPSHOT_MAX = 30;
  const CHART_UNIVERSE_MAX = 100;
  const KR_MARKETS = new Set(["kr_kospi", "kr_kosdaq"]);
  const US_MARKETS = new Set(["nyse", "nasdaq"]);
  const SNAPSHOT_MARKETS = new Set([...KR_MARKETS, ...US_MARKETS]);
  const SNAPSHOT_REGION = {
    kr_kospi: "kr",
    kr_kosdaq: "kr",
    nyse: "us",
    nasdaq: "us"
  };
  const SNAPSHOT_SESSION_KEYS = {
    kr: "chart-kr-snapshot-v2",
    us: "chart-us-snapshot-v2"
  };
  const DEFAULT_SNAPSHOT_JSON = {
    kr: "data/chart-kr-snapshot.json",
    us: "data/chart-us-snapshot.json"
  };

  const FONT_SCALE_KEY = "dw_chart_font_scale";
  const FONT_SCALE_MIN = 0.72;
  const FONT_SCALE_MAX = 1.08;
  const FONT_SCALE_STEP = 0.06;
  const FONT_SCALE_DEFAULT = 0.82;

  let activeMarket = "kr_kospi";
  let fontScale = FONT_SCALE_DEFAULT;
  let abortController = null;
  let krSnapshot = null;
  let usSnapshot = null;
  const snapshotPromises = { kr: null, us: null };
  const marketViewState = new Map();
  const chartPanelState = new WeakMap();
  const chartPanelLoadTimers = new WeakMap();
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

  function getSnapshotJsonUrl(region, bust) {
    const path =
      region === "kr"
        ? window.CHART_KR_JSON_URL || DEFAULT_SNAPSHOT_JSON.kr
        : window.CHART_US_JSON_URL || DEFAULT_SNAPSHOT_JSON.us;
    const url = new URL(path, window.location.href);
    if (bust) url.searchParams.set("t", String(Date.now()));
    return url.href;
  }

  function readSnapshotSession(region) {
    try {
      const raw = sessionStorage.getItem(SNAPSHOT_SESSION_KEYS[region]);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : null;
    } catch (_) {
      return null;
    }
  }

  function writeSnapshotSession(region, payload) {
    try {
      if (payload) sessionStorage.setItem(SNAPSHOT_SESSION_KEYS[region], JSON.stringify(payload));
    } catch (_) {
      /* quota */
    }
  }

  function getSnapshotCache(region) {
    return region === "kr" ? krSnapshot : usSnapshot;
  }

  function setSnapshotCache(region, payload) {
    if (region === "kr") krSnapshot = payload;
    else usSnapshot = payload;
  }

  function preloadChartsFromSnapshot(snapshot) {
    for (const market of Object.values(snapshot?.markets || {})) {
      for (const [ticker, periods] of Object.entries(market.charts || {})) {
        for (const [period, data] of Object.entries(periods)) {
          if (data?.candles?.length) {
            chartDataCache.set(`${ticker}:${period}`, data);
          }
        }
      }
    }
  }

  function formatSnapshotUpdated(iso, region) {
    if (!iso) return "";
    try {
      const dt = new Date(iso);
      if (Number.isNaN(dt.getTime())) return "";
      const timeZone = region === "us" ? "America/New_York" : "Asia/Seoul";
      const tzLabel = region === "us" ? "ET" : "KST";
      const formatted = dt.toLocaleString("ko-KR", {
        timeZone,
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
      return `${formatted} (${tzLabel})`;
    } catch (_) {
      return "";
    }
  }

  async function loadRegionSnapshot(region, bust = false) {
    const cached = getSnapshotCache(region);
    if (cached && !bust) return cached;
    if (snapshotPromises[region] && !bust) return snapshotPromises[region];

    snapshotPromises[region] = (async () => {
      if (!bust) {
        const session = readSnapshotSession(region);
        if (session?.markets) {
          setSnapshotCache(region, session);
          preloadChartsFromSnapshot(session);
          return session;
        }
      }

      try {
        const res = await fetch(getSnapshotJsonUrl(region, bust), { cache: bust ? "no-store" : "default" });
        if (res.ok) {
          const data = await res.json();
          if (data?.markets) {
            setSnapshotCache(region, data);
            writeSnapshotSession(region, data);
            preloadChartsFromSnapshot(data);
            return data;
          }
        }
      } catch (_) {
        /* fall through */
      }

      const base = getApiBase();
      if (base) {
        try {
          const apiPath = region === "kr" ? "/api/chart/kr-snapshot" : "/api/chart/us-snapshot";
          const res = await fetch(`${base}${apiPath}`, { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            if (data?.markets) {
              setSnapshotCache(region, data);
              writeSnapshotSession(region, data);
              preloadChartsFromSnapshot(data);
              return data;
            }
          }
        } catch (_) {
          /* noop */
        }
      }

      return null;
    })();

    try {
      return await snapshotPromises[region];
    } finally {
      snapshotPromises[region] = null;
    }
  }

  async function loadMarketSnapshot(market) {
    const region = SNAPSHOT_REGION[market];
    if (!region) return null;
    return loadRegionSnapshot(region);
  }

  async function fetchMarketTop10(market) {
    if (SNAPSHOT_MARKETS.has(market)) {
      const region = SNAPSHOT_REGION[market];
      const snap = await loadRegionSnapshot(region);
      const block = snap?.markets?.[market];
      if (block?.items?.length) {
        const items = block.items.slice(0, CHART_SNAPSHOT_MAX);
        return {
          market,
          segmentTitle: block.segmentTitle || CHART_MARKETS.find((m) => m.id === market)?.label || market,
          items,
          source: "snapshot",
          updatedAt: snap.updatedAt,
          updateSchedule: snap.updateSchedule,
          region,
          universeTotal: CHART_UNIVERSE_MAX,
          snapshotCount: CHART_SNAPSHOT_MAX
        };
      }
    }

    const base = getApiBase();
    if (!base) {
      return {
        market,
        segmentTitle: CHART_MARKETS.find((m) => m.id === market)?.label || market,
        items: fallbackItems(market).slice(0, CHART_SNAPSHOT_MAX),
        offline: true,
        universeTotal: CHART_UNIVERSE_MAX,
        snapshotCount: CHART_SNAPSHOT_MAX
      };
    }

    if (abortController) abortController.abort();
    abortController = new AbortController();
    const signal = abortController.signal;

    await warmApi(base);
    const url = `${base}/api/market-top10?market=${encodeURIComponent(market)}&offset=0&limit=${CHART_SNAPSHOT_MAX}`;
    const data = await fetchJsonWithRetry(url, signal, { retries: 2, timeoutMs: 120000 });
    return {
      ...data,
      universeTotal: data.universeTotal ?? CHART_UNIVERSE_MAX,
      snapshotCount: data.snapshotCount ?? CHART_SNAPSHOT_MAX
    };
  }

  async function fetchMarketItemsApi(market, offset, limit) {
    const base = getApiBase();
    if (!base) {
      throw new Error("STOCK_API_URL이 설정되지 않았습니다.");
    }
    await warmApi(base);
    const url = `${base}/api/market-top10?market=${encodeURIComponent(market)}&offset=${offset}&limit=${limit}`;
    return fetchJsonWithRetry(url, null, { retries: 2, timeoutMs: 120000 });
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

  function clearChartPanelLoadTimer(panel) {
    const timer = chartPanelLoadTimers.get(panel);
    if (timer) {
      clearInterval(timer);
      chartPanelLoadTimers.delete(panel);
    }
  }

  function isApiChartWait(panel, period) {
    const rank = Number(panel.dataset.rank || 0);
    const periodToUse = period || panel.dataset.period || DEFAULT_CHART_PERIOD;
    const cacheKey = `${panel.dataset.ticker}:${periodToUse}`;
    if (chartDataCache.has(cacheKey)) return false;
    return rank > CHART_SNAPSHOT_MAX;
  }

  function showChartPanelLoading(panel, apiWait = false) {
    const chartRoot = panel.querySelector("[data-chart-root]");
    if (!chartRoot) return;

    clearChartPanelLoadTimer(panel);
    chartRoot.hidden = false;
    chartRoot.classList.add("is-loading");

    const hint = apiWait
      ? `<p class="chart-panel-loading-hint">API에서 차트를 가져오는 중입니다. Render 서버 첫 요청은 최대 1~2분 걸릴 수 있습니다.</p>`
      : "";

    chartRoot.innerHTML = `
      <div class="chart-panel-loading" data-chart-loading aria-live="polite">
        <div class="chart-panel-spinner" role="status" aria-label="차트 로딩 중"></div>
        <p class="chart-panel-loading-text">차트 불러오는 중… <span class="chart-panel-elapsed" data-chart-elapsed>0</span>초</p>
        ${hint}
      </div>
    `;

    const statusEl = panel.querySelector("[data-chart-status]");
    if (statusEl) statusEl.hidden = true;

    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 1;
      const el = chartRoot.querySelector("[data-chart-elapsed]");
      if (el) el.textContent = String(elapsed);
    }, 1000);
    chartPanelLoadTimers.set(panel, timer);
  }

  function hideChartPanelLoading(panel) {
    clearChartPanelLoadTimer(panel);
    const chartRoot = panel.querySelector("[data-chart-root]");
    if (!chartRoot) return;
    chartRoot.classList.remove("is-loading");
    chartRoot.querySelector("[data-chart-loading]")?.remove();
  }

  function destroyChartPanel(panel) {
    clearChartPanelLoadTimer(panel);
    const state = chartPanelState.get(panel);
    if (state) {
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
    }
    const chartRoot = panel.querySelector("[data-chart-root]");
    if (chartRoot) {
      chartRoot.classList.remove("is-loading");
      chartRoot.replaceChildren();
      chartRoot.hidden = true;
    }
    panel.querySelector("[data-rsi-root]")?.replaceChildren();
    panel.querySelector("[data-macd-root]")?.replaceChildren();
    const rsiRoot = panel.querySelector("[data-rsi-root]");
    const macdRoot = panel.querySelector("[data-macd-root]");
    if (rsiRoot) rsiRoot.hidden = true;
    if (macdRoot) macdRoot.hidden = true;
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

  function buildChartRowHtml(item, idx) {
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
          <div class="chart-panel" data-ticker="${escapeHtml(item.ticker)}" data-name="${escapeHtml(item.name)}" data-rank="${item.rank ?? idx + 1}" data-period="${DEFAULT_CHART_PERIOD}" data-loaded="">
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
  }

  function updateListStatus(container) {
    const statusEl = container.querySelector("#chart-status");
    const state = marketViewState.get(activeMarket);
    if (!statusEl || !state) return;

    const meta = state.meta || {};
    const total = state.allItems.length;
    const visible = state.visibleCount;

    if (meta.offline) {
      statusEl.textContent = "API 연결 없음 — 종목 목록만 표시됩니다. 시세·차트는 API 연결 후 이용하세요.";
      statusEl.className = "chart-status chart-status--warn";
      statusEl.hidden = false;
      return;
    }
    if (meta.error) {
      statusEl.textContent = meta.error;
      statusEl.className = "chart-status chart-status--error";
      statusEl.hidden = false;
      return;
    }

    const region = meta.region || SNAPSHOT_REGION[activeMarket] || "kr";
    const schedule = meta.updateSchedule || "";
    const updated = formatSnapshotUpdated(meta.updatedAt, region);
    const universeTotal = state.universeTotal ?? CHART_UNIVERSE_MAX;
    const snapCount = state.snapshotCount ?? CHART_SNAPSHOT_MAX;
    const snapNote =
      meta.source === "snapshot" && updated
        ? ` · 스냅샷 ${updated}`
        : meta.source === "snapshot" && schedule
          ? ` · ${schedule}`
          : "";
    const rangeNote =
      total <= snapCount
        ? `TOP ${snapCount} 스냅샷`
        : `TOP ${universeTotal} (1~${snapCount} 스냅샷 · 이후 API)`;
    statusEl.textContent = `${meta.segmentTitle || ""} · ${visible}/${total}개 표시 · ${rangeNote} · 일봉 (1M~10Y)${snapNote}`;
    statusEl.className = "chart-status chart-status--info";
    statusEl.hidden = false;
  }

  function updateLoadMoreButton(container) {
    const listEl = container.querySelector("#chart-list");
    const state = marketViewState.get(activeMarket);
    if (!listEl || !state) return;

    let footer = listEl.querySelector(".chart-load-more-wrap");
    const universeTotal = state.universeTotal ?? CHART_UNIVERSE_MAX;
    const canRevealLocal = state.visibleCount < state.allItems.length;
    const canFetchApi = !canRevealLocal && state.allItems.length < universeTotal;

    if (!canRevealLocal && !canFetchApi) {
      footer?.remove();
      return;
    }

    let label;
    if (canRevealLocal) {
      const remaining = state.allItems.length - state.visibleCount;
      const nextCount = Math.min(CHART_PAGE_STEP, remaining);
      label = `종목 더보기 (+${nextCount}개 · ${state.visibleCount}/${state.allItems.length})`;
    } else {
      const nextOffset = state.allItems.length;
      const nextCount = Math.min(CHART_PAGE_STEP, universeTotal - nextOffset);
      const rankEnd = Math.min(nextOffset + nextCount, universeTotal);
      label = `API로 종목 더보기 (+${nextCount}개 · ${nextOffset + 1}~${rankEnd}위)`;
    }

    if (!footer) {
      listEl.insertAdjacentHTML(
        "beforeend",
        `<div class="chart-load-more-wrap"><button type="button" class="secondary-btn chart-load-more-btn" id="chart-load-more">${label}</button></div>`
      );
      return;
    }

    const btn = footer.querySelector(".chart-load-more-btn");
    if (btn) {
      btn.textContent = label;
      btn.disabled = false;
    }
  }

  function bindLoadMore(container) {
    const listEl = container.querySelector("#chart-list");
    if (!listEl || listEl.dataset.loadMoreBound === "1") return;
    listEl.dataset.loadMoreBound = "1";

    listEl.addEventListener("click", async (e) => {
      const btn = e.target.closest(".chart-load-more-btn");
      if (!btn || btn.disabled) return;

      const state = marketViewState.get(activeMarket);
      if (!state) return;

      const universeTotal = state.universeTotal ?? CHART_UNIVERSE_MAX;

      if (state.visibleCount < state.allItems.length) {
        const prevVisible = state.visibleCount;
        state.visibleCount = Math.min(state.visibleCount + CHART_PAGE_STEP, state.allItems.length);
        if (state.visibleCount === prevVisible) return;

        const tbody = listEl.querySelector("tbody");
        const newItems = state.allItems.slice(prevVisible, state.visibleCount);
        newItems.forEach((item, i) => {
          tbody.insertAdjacentHTML("beforeend", buildChartRowHtml(item, prevVisible + i));
        });
        bindListControls(listEl);
        updateLoadMoreButton(container);
        updateListStatus(container);
        return;
      }

      if (state.allItems.length >= universeTotal) return;

      const prevLoaded = state.allItems.length;
      const fetchCount = Math.min(CHART_PAGE_STEP, universeTotal - prevLoaded);
      btn.disabled = true;
      btn.textContent = "API에서 불러오는 중…";

      try {
        const data = await fetchMarketItemsApi(activeMarket, prevLoaded, fetchCount);
        const newItems = data?.items?.length ? data.items : [];
        if (!newItems.length) {
          btn.textContent = "추가 종목 없음";
          return;
        }

        const tbody = listEl.querySelector("tbody");
        newItems.forEach((item, i) => {
          state.allItems.push(item);
          tbody.insertAdjacentHTML("beforeend", buildChartRowHtml(item, prevLoaded + i));
        });
        state.visibleCount = state.allItems.length;
        if (data.source === "api") {
          state.meta = { ...state.meta, source: "hybrid" };
        }
        bindListControls(listEl);
        updateLoadMoreButton(container);
        updateListStatus(container);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = formatFetchError(err, getApiBase());
      }
    });
  }

  function renderList(container, data) {
    const listEl = container.querySelector("#chart-list");
    const snapshotCount = data?.snapshotCount ?? CHART_SNAPSHOT_MAX;
    const universeTotal = data?.universeTotal ?? CHART_UNIVERSE_MAX;
    const allItems = (data?.items?.length ? data.items : fallbackItems(activeMarket)).slice(0, snapshotCount);
    const visibleCount = Math.min(CHART_PAGE_INITIAL, allItems.length);

    marketViewState.set(activeMarket, {
      allItems,
      visibleCount,
      universeTotal,
      snapshotCount,
      meta: {
        segmentTitle: data?.segmentTitle,
        source: data?.source,
        updatedAt: data?.updatedAt,
        updateSchedule: data?.updateSchedule,
        region: data?.region || SNAPSHOT_REGION[activeMarket],
        error: data?.error,
        offline: data?.offline
      }
    });

    const items = allItems.slice(0, visibleCount);
    updateListStatus(container);

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
            ${items.map((item, idx) => buildChartRowHtml(item, idx)).join("")}
          </tbody>
        </table>
      </div>
    `;

    listEl.dataset.loadMoreBound = "";
    bindListControls(listEl);
    bindLoadMore(container);
    updateLoadMoreButton(container);
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

    const apiWait = isApiChartWait(panel, period);
    showChartPanelLoading(panel, apiWait);

    try {
      const enabled = getEnabledIndicators(panel);
      const data = await fetchChartData(ticker, period);
      if (!data?.candles?.length) {
        hideChartPanelLoading(panel);
        chartRoot.hidden = true;
        if (statusEl) {
          statusEl.className = "chart-panel-status chart-panel-status--error";
          statusEl.textContent = "표시할 차트 데이터가 없습니다.";
          statusEl.hidden = false;
        }
        panel.dataset.loaded = "";
        return;
      }

      hideChartPanelLoading(panel);
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
      hideChartPanelLoading(panel);
      chartRoot.hidden = true;
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

    listEl.innerHTML = `<p class="chart-loading">${SNAPSHOT_MARKETS.has(market) ? "스냅샷을 불러오는 중…" : "시세를 불러오는 중…"}<br><span class="chart-loading-hint">${SNAPSHOT_MARKETS.has(market) ? (KR_MARKETS.has(market) ? "한국 시장은 매일 18:00 (KST) 스냅샷이 갱신됩니다." : "미국 시장은 매일 18:00 (ET) 스냅샷이 갱신됩니다.") : "Render 무료 서버 첫 요청은 최대 1분 걸릴 수 있습니다."}</span></p>`;
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
            <p class="chart-intro">시가총액 TOP 100 종목(1~30위 스냅샷 · 31~100위 API)의 시세와 일봉 차트(1M~10Y)를 확인합니다. KOSPI·KOSDAQ 18:00 KST, NYSE·NASDAQ 18:00 ET 스냅샷 갱신.</p>
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
    krSnapshot = null;
    usSnapshot = null;
    snapshotPromises.kr = null;
    snapshotPromises.us = null;
    marketViewState.clear();
  }

  window.DwChart = {
    renderPage,
    destroy
  };
  // legacy alias
  window.Chart = window.DwChart;
})();
