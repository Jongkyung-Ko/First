/**
 * Stock Picks — 단기추천로직 (전략 설명 + 14일 성과 비교, 점진적 로딩)
 */
(function () {
  const KR_KEYS = ["kospi", "kosdaq"];
  const US_KEYS = ["nasdaq", "nyse"];

  let renderGeneration = 0;

  const FORMULA_ITEMS = [
    {
      id: "sentiment",
      pageId: "stock-picks",
      label: "감성뉴스",
      kind: "sentiment",
      strategy: {
        id: "sentiment-news",
        title: "감성뉴스",
        universe: "KOSPI TOP 10 · KOSDAQ TOP 10 · 미국 TOP 10",
        summary:
          "Yahoo Finance 헤드라인을 AI 감성 분석해 호재·악재 건수를 집계하고, 점수로 추천·관망·주의를 판정합니다.",
        rules: [
          "유니버스: 시가총액 상위 10종목 (시장별 탭)",
          "뉴스 윈도우: 최근 7일 헤드라인 (종목 직접 언급·연관 티커 포함)",
          "점수 = 호재 건수 × 2 − 악재 건수 × 2 (동일 가중 · 예: 호재 2·악재 2 → 0점)",
          "추천: 점수 ≥ 4 · 주의: 악재 2건 이상이고 호재보다 많음 · 그 외 관망",
          "매일 장 시작 전(한국 06:50 KST / 미국 08:00 ET) 예측 저장",
          "적중 판정: 익일 종가 대비 — 추천 +0.5% 초과 상승=적중, 주의 −0.5% 미만=적중, 관망 ±0.5% 밴드",
          "종가·적중 여부는 장 마감 후 자동 반영 (한국 16:00 KST / 미국 장 마감 후)"
        ],
        patterns: [
          {
            id: "recommend",
            label: "추천",
            description: "호재가 우세하고 점수 4 이상 — 단기 상승 기대 구간"
          },
          {
            id: "watch",
            label: "관망",
            description: "호재·악재가 균형이거나 신호가 약한 구간"
          },
          {
            id: "caution",
            label: "주의",
            description: "악재가 2건 이상이며 호재보다 많음 — 하락 리스크 관찰"
          }
        ],
        disclaimer:
          "뉴스 감성은 참고용이며 투자 권유가 아닙니다. 14일 성과는 저장된 예측 대비 익일 종가 적중률입니다."
      }
    },
    {
      id: "recommend2",
      pageId: "recommend2",
      label: "바닥매집",
      jsonUrl: "data/recommend2-bottom-accumulation.json",
      apiPath: "/api/recommend2/bottom-accumulation"
    },
    {
      id: "golden",
      pageId: "strategy-golden",
      label: "골든크로스",
      dataKey: "golden",
      apiPath: "/api/stock-strategy/golden-cross"
    },
    {
      id: "bollinger",
      pageId: "strategy-bollinger",
      label: "볼린저밴드",
      dataKey: "bollinger",
      apiPath: "/api/stock-strategy/bollinger"
    },
    {
      id: "rsi",
      pageId: "strategy-rsi",
      label: "RSI+다이버전스",
      dataKey: "rsi",
      apiPath: "/api/stock-strategy/rsi-divergence"
    },
    {
      id: "candle",
      pageId: "strategy-candle-support",
      label: "지지+반전캔들",
      dataKey: "candleSupport",
      apiPath: "/api/stock-strategy/candle-support"
    },
    {
      id: "obv",
      pageId: "strategy-obv",
      label: "OBV+다이버전스",
      dataKey: "obv",
      apiPath: "/api/stock-strategy/obv-divergence"
    },
    {
      id: "bottom",
      pageId: "strategy-bottom",
      label: "쌍·삼중바닥",
      dataKey: "bottom",
      apiPath: "/api/stock-strategy/bottom-pattern"
    },
    {
      id: "vcp",
      pageId: "strategy-vcp",
      label: "VCP",
      dataKey: "vcp",
      apiPath: "/api/stock-strategy/vcp"
    },
    {
      id: "fundamentals-per",
      pageId: "fundamentals-per",
      label: "PER",
      kind: "fundamentals",
      jsonUrl: "data/stock-fundamentals.json",
      strategy: {
        id: "fundamentals-per",
        title: "PER (주가수익비율 · Price Earnings Ratio)",
        universe: "KOSPI·KOSDAQ·NASDAQ·NYSE 각 TOP 200 → PER 낮은 순 TOP 20",
        summary:
          "주가를 주당순이익(EPS)으로 나눈 값입니다. 같은 이익을 낼 때 PER이 낮을수록 시장이 그 이익을 ‘싸게’ 평가한다는 뜻으로, **가치투자·저평가 탐색**에 자주 쓰입니다.",
        rules: [
          "계산: PER ≈ 주가 ÷ 주당순이익 (trailing 12개월 기준)",
          "의미: PER 10 → 이론상 10년치 이익으로 시가총액을 회수하는 수준(단순 비유)",
          "낮을수록: 동종·동일 성장 전제에서 상대적 저평가 후보",
          "주의: 적자 기업은 PER이 없거나 왜곡 · 성장주는 PER이 높아도 정당화될 수 있음",
          "스크리닝: TOP 200 중 0 < PER ≤ 100, 적자 제외 후 낮은 순 TOP 20",
          "KOSPI·KOSDAQ 20:30 KST · NASDAQ·NYSE 21:30 ET 자동 갱신",
          "Push 알림: 이 지표 추천 종목은 8시 정기 알림·9공식 digest에 포함되지 않음 (참고용)"
        ],
        patterns: [
          {
            id: "low-per",
            label: "저PER",
            description: "이익 대비 주가가 낮음 — 업황·일회성 이익·구조적 쇠퇴를 구분해 해석 필요"
          },
          {
            id: "why-invest",
            label: "투자 관점",
            description: "실적이 유지·개선될 때 PER 리레이팅(주가 상승) 여지 — ‘싸고’ ‘나아지는’ 조합을 찾는 도구"
          }
        ],
        disclaimer:
          "Yahoo Finance·Open DART(한국 PER) 기준이며 투자 권유가 아닙니다. 알림 대상이 아닌 참고용 스크리닝입니다."
      }
    },
    {
      id: "fundamentals-roe",
      pageId: "fundamentals-roe",
      label: "ROE",
      kind: "fundamentals",
      jsonUrl: "data/stock-fundamentals.json",
      strategy: {
        id: "fundamentals-roe",
        title: "ROE (자기자본이익률 · Return on Equity)",
        universe: "KOSPI·KOSDAQ·NASDAQ·NYSE 각 TOP 200 → ROE 높은 순 TOP 20",
        summary:
          "순이익을 자기자본(주주 지분)으로 나눈 비율입니다. **같은 자본으로 얼마나 많은 이익을 내는지**를 보여 주며, 우량·효율적 경영 기업을 고르는 데 널리 쓰입니다.",
        rules: [
          "계산: ROE = 순이익 ÷ 자기자본 × 100%",
          "의미: ROE 15% → 주주 돈 100원으로 15원 순이익 (단순화)",
          "높을수록: 자본 효율·수익성이 좋다는 신호 (동종 비교 전제)",
          "주의: 부채를 크게 쓰면 ROE가 부풀려질 수 있음 · 일회성 이익·자본 감소도 왜곡",
          "스크리닝: TOP 200 중 ROE > 0, 높은 순 TOP 20",
          "장 마감 후 자동 갱신 · Push 알림 미포함"
        ],
        patterns: [
          {
            id: "high-roe",
            label: "고ROE",
            description: "지속 가능한 고ROE는 ‘해자’·브랜드·규모의 경제와 연결되는 경우가 많음"
          },
          {
            id: "why-invest",
            label: "투자 관점",
            description: "장기 복리 관점에서 주주 이익 창출력이 핵심 — 성장·배당·자사주 매입과 함께 보면 유용"
          }
        ],
        disclaimer:
          "재무제표·Yahoo 값 시차가 있을 수 있습니다. 알림 대상 외 참고용입니다."
      }
    },
    {
      id: "fundamentals-pbr",
      pageId: "fundamentals-pbr",
      label: "PBR",
      kind: "fundamentals",
      jsonUrl: "data/stock-fundamentals.json",
      strategy: {
        id: "fundamentals-pbr",
        title: "PBR (주가순자산비율 · Price to Book)",
        universe: "KOSPI·KOSDAQ·NASDAQ·NYSE 각 TOP 200 → PBR 낮은 순 TOP 20",
        summary:
          "주가를 주당순자산(BPS)으로 나눈 값입니다. **자산 대비 주가가 얼마나 비싼지(또는 싼지)**를 보여 주며, 금융·제조 등 자산이 큰 업종의 상대 가치 비교에 유용합니다.",
        rules: [
          "계산: PBR ≈ 주가 ÷ 주당순자산",
          "의미: PBR 1.0 → 장부상 순자산과 시가총액이 비슷한 수준",
          "낮을수록: 자산 대비 저평가 후보 (청산가치·NAV와 연결해 해석)",
          "주의: 무형자산·브랜드가 큰 기업은 장부가치만으로는 부족 · 적자·자본잠식 시 왜곡",
          "스크리닝: TOP 200 중 0 < PBR ≤ 20, 낮은 순 TOP 20",
          "장 마감 후 자동 갱신 · Push 알림 미포함"
        ],
        patterns: [
          {
            id: "low-pbr",
            label: "저PBR",
            description: "자산 기준 ‘싼’ 종목 — 업종 특성(은행 vs IT)을 반드시 함께 비교"
          },
          {
            id: "why-invest",
            label: "투자 관점",
            description: "저PBR + ROE 개선·실적 턴어라운드 조합은 ‘가치+촉매’ 관점에서 자주 검토"
          }
        ],
        disclaimer:
          "Yahoo·Open DART(한국 BPS) 기준. 장부가와 시장가치의 괴리를 반영하지 못할 수 있습니다. 알림 대상 외 참고용입니다."
      }
    },
    {
      id: "fundamentals-dividend",
      pageId: "fundamentals-dividend",
      label: "배당수익률",
      kind: "fundamentals",
      jsonUrl: "data/stock-fundamentals.json",
      strategy: {
        id: "fundamentals-dividend",
        title: "배당수익률 (Dividend Yield)",
        universe: "KOSPI·KOSDAQ·NASDAQ·NYSE 각 TOP 200 → 배당수익률 높은 순 TOP 20",
        summary:
          "연간 배당금을 현재 주가로 나눈 비율입니다. **주가 변동과 별도로 현금 흐름(배당) 수준**을 보여 주며, 장기 보유·소득형 포트폴리오 구성에 참고합니다.",
        rules: [
          "계산: 배당수익률 ≈ 연간 배당금 ÷ 주가 × 100%",
          "의미: 4% → 투자금 100원당 연 4원 배당(세전·정책 미반영 단순화)",
          "높을수록: 현재 주가 대비 배당 소득 비중이 큼",
          "주의: 일회성 특별배당·배당 삭감 위험 · 고배당은 성장 둔화·주가 하락 반영일 수 있음",
          "스크리닝: TOP 200 중 배당 > 0, 높은 순 TOP 20",
          "장 마감 후 자동 갱신 · Push 알림 미포함"
        ],
        patterns: [
          {
            id: "high-yield",
            label: "고배당",
            description: "배당 성향·FCF·부채와 함께 ‘지속 가능한 배당’인지 확인 필요"
          },
          {
            id: "why-invest",
            label: "투자 관점",
            description: "변동성 완충·현금 수익 — PER·ROE와 병행해 ‘싸면서 배당도 주는’ 종목 탐색"
          }
        ],
        disclaimer:
          "배당 정책·세금·환율은 반영되지 않습니다. 알림 대상 외 참고용입니다."
      }
    }
  ];

  /** 14일 수익률 비교표 — PER/ROE/PBR/배당 제외 (장기 탭 전용) */
  const COMPARE_ITEMS = FORMULA_ITEMS.filter((item) => item.kind !== "fundamentals");
  const HOLD_DAYS = [1, 2, 3, 4, 5];

  const STATIC_JSON_BY_DATA_KEY = {
    golden: () => window.STOCK_STRATEGY_GOLDEN_JSON_URL,
    bollinger: () => window.STOCK_STRATEGY_BOLLINGER_JSON_URL,
    rsi: () => window.STOCK_STRATEGY_RSI_JSON_URL,
    candleSupport: () => window.STOCK_STRATEGY_CANDLE_JSON_URL,
    obv: () => window.STOCK_STRATEGY_OBV_JSON_URL,
    bottom: () => window.STOCK_STRATEGY_BOTTOM_JSON_URL,
    vcp: () => window.STOCK_STRATEGY_VCP_JSON_URL
  };

  function resolveStaticJsonUrl(item) {
    if (item.jsonUrl) return item.jsonUrl;
    if (item.dataKey && window.StockStrategyData?.[item.dataKey]?.jsonUrl) {
      return window.StockStrategyData[item.dataKey].jsonUrl;
    }
    const fromConfig = STATIC_JSON_BY_DATA_KEY[item.dataKey]?.();
    return fromConfig || null;
  }

  function signalHoldKey(sig) {
    return `${String(sig?.ticker || "").trim()}|${String(sig?.signalDate || "").slice(0, 10)}`;
  }

  function buildSignalHoldIndex(payload) {
    const idx = new Map();
    if (!payload?.markets) return idx;
    for (const key of [...KR_KEYS, ...US_KEYS]) {
      const list = payload.markets[key]?.recentSignals;
      if (!Array.isArray(list)) continue;
      for (const sig of list) {
        if (!sig || typeof sig !== "object") continue;
        idx.set(signalHoldKey(sig), sig);
      }
    }
    return idx;
  }

  function mergeHoldFieldsFromSource(target, source) {
    if (!target?.markets || !source?.markets) return target;
    const srcIdx = buildSignalHoldIndex(source);
    if (!srcIdx.size) return target;
    for (const key of [...KR_KEYS, ...US_KEYS]) {
      const block = target.markets[key];
      const list = block?.recentSignals;
      if (!Array.isArray(list)) continue;
      for (const sig of list) {
        const src = srcIdx.get(signalHoldKey(sig));
        if (!src) continue;
        for (const day of HOLD_DAYS) {
          const field = `holdDay${day}ReturnPct`;
          if (sig[field] == null && src[field] != null) sig[field] = src[field];
        }
        if (!sig.entryDate && src.entryDate) sig.entryDate = src.entryDate;
        if (sig.entryClose == null && src.entryClose != null) sig.entryClose = src.entryClose;
      }
    }
    return target;
  }

  function holdStatsHasData(holdStats) {
    if (!holdStats) return false;
    for (const region of ["kr", "us"]) {
      for (const day of HOLD_DAYS) {
        if ((holdStats[region]?.[`day${day}`]?.returnCount || 0) > 0) return true;
      }
    }
    return false;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

  const BOTTOM_ACCUM_SCHEDULE =
    "한국 18:00 · 미국(뉴욕) 18:00 (장 마감 후, 현지 시각)";

  const SHORT_TERM_STRATEGY_SCHEDULE =
    "한국 18:45→19:30→20:15→21:00 · 미국 18:45→19:30→20:15→21:15 (45분 간격, 2종씩)";

  const UPDATE_SCHEDULE_ROWS = [
    {
      label: "단기추천로직",
      schedule: "자동 갱신 없음 (비교·설명만)"
    },
    {
      label: "감성뉴스",
      schedule: "한국 08:00 · 14:00 / 미국(뉴욕) 08:00 · 14:00 — 하루 4회"
    },
    {
      label: "바닥매집",
      schedule: BOTTOM_ACCUM_SCHEDULE
    },
    {
      label: "골든크로스 · 볼린저밴드",
      schedule: `18:45 (현지) — ${SHORT_TERM_STRATEGY_SCHEDULE}`
    },
    {
      label: "RSI+다이버전스 · 지지+반전캔들",
      schedule: `19:30 (현지) — ${SHORT_TERM_STRATEGY_SCHEDULE}`
    },
    {
      label: "OBV+다이버전스 · 쌍·삼중바닥",
      schedule: `20:15 (현지) — ${SHORT_TERM_STRATEGY_SCHEDULE}`
    },
    {
      label: "VCP",
      schedule: `한국 21:00 · 미국 21:15 (현지)`
    },
    {
      label: "차트 스냅샷",
      schedule: "한국 21:30 · 미국 20:45 (현지) — Render 스캔"
    }
  ];

  function renderUpdateScheduleTable() {
    return `
      <div class="fundamentals-table-wrap long-term-schedule-wrap stock-formulas-schedule-wrap">
        <table class="recommend2-match-table fundamentals-table long-term-schedule-table stock-formulas-schedule-table">
          <thead>
            <tr>
              <th scope="col">로직</th>
              <th scope="col">자동 갱신 시각</th>
            </tr>
          </thead>
          <tbody>
            ${UPDATE_SCHEDULE_ROWS.map(
              (row) => `
            <tr>
              <th scope="row" class="long-term-schedule-label">${escapeHtml(row.label)}</th>
              <td>${escapeHtml(row.schedule)}</td>
            </tr>`
            ).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderUpdateScheduleSection() {
    return `
      <details class="long-term-guide-details long-term-schedule-details stock-formulas-schedule-details">
        <summary class="long-term-guide-summary long-term-schedule-summary">정보 업데이트 시점</summary>
        <div class="long-term-guide-body long-term-schedule-body">
          <p class="long-term-schedule-intro">
            바닥매집·6개 전략은 각 시장 장 마감 후 갱신됩니다. 미국 시각은 뉴욕 현지 기준입니다.
          </p>
          ${renderUpdateScheduleTable()}
        </div>
      </details>`;
  }

  function getApiBase() {
    const url = window.STOCK_API_URL;
    if (!url || typeof url !== "string") return null;
    return url.replace(/\/$/, "");
  }

  function isPlaceholder(payload) {
    return window.StockStrategyData?.isPlaceholderPayload?.(payload) ?? false;
  }

  function strategyLooksComplete(strategy) {
    return Boolean(strategy?.title && Array.isArray(strategy?.rules) && strategy.rules.length >= 3);
  }

  function computeMatchStats(signals) {
    let match = 0;
    let mismatch = 0;
    let pending = 0;
    for (const sig of signals || []) {
      const dm = sig.directionMatch;
      if (dm === "일치") match += 1;
      else if (dm === "불일치") mismatch += 1;
      else pending += 1;
    }
    const evaluated = match + mismatch;
    const ratePct = evaluated > 0 ? (match / evaluated) * 100 : null;
    return { match, mismatch, pending, total: (signals || []).length, evaluated, ratePct };
  }

  function computeReturnStats(signals) {
    const returns = (signals || [])
      .map((sig) => signalHoldDayReturn(sig, 1))
      .filter((v) => v != null && Number.isFinite(Number(v)))
      .map((v) => Number(v));
    const returnCount = returns.length;
    const returnSumPct = returnCount > 0 ? returns.reduce((sum, v) => sum + v, 0) : null;
    return {
      returnSumPct,
      returnCount,
      returnUp: returns.filter((r) => r > 0).length,
      returnDown: returns.filter((r) => r < 0).length
    };
  }

  function signalHoldDayReturn(sig, day) {
    if (day === 1) {
      if (sig?.holdDay1ReturnPct != null && Number.isFinite(Number(sig.holdDay1ReturnPct))) {
        return Number(sig.holdDay1ReturnPct);
      }
      if (sig?.dayReturnPct != null && Number.isFinite(Number(sig.dayReturnPct))) {
        return Number(sig.dayReturnPct);
      }
      const sigClose = sig?.close;
      const nextClose = sig?.nextClose;
      if (sigClose != null && nextClose != null && Number(sigClose) !== 0) {
        return ((Number(nextClose) / Number(sigClose)) - 1) * 100;
      }
      return null;
    }
    const field = `holdDay${day}ReturnPct`;
    const v = sig?.[field];
    return v != null && Number.isFinite(Number(v)) ? Number(v) : null;
  }

  function computeHoldReturnStats(signals, day) {
    const returns = (signals || [])
      .map((sig) => signalHoldDayReturn(sig, day))
      .filter((v) => v != null && Number.isFinite(Number(v)))
      .map((v) => Number(v));
    const returnCount = returns.length;
    const returnSumPct = returnCount > 0 ? returns.reduce((sum, v) => sum + v, 0) : null;
    return { returnSumPct, returnCount };
  }

  function mergeRegionSignals(payload, keys) {
    const markets = payload?.markets || {};
    const out = [];
    for (const key of keys) {
      const list = markets[key]?.recentSignals;
      if (Array.isArray(list)) out.push(...list);
    }
    return out;
  }

  function statsFromPayload(payload) {
    if (!payload || isPlaceholder(payload)) return null;
    const krSignals = mergeRegionSignals(payload, KR_KEYS);
    const usSignals = mergeRegionSignals(payload, US_KEYS);
    return {
      kr: { ...computeMatchStats(krSignals), ...computeReturnStats(krSignals) },
      us: { ...computeMatchStats(usSignals), ...computeReturnStats(usSignals) }
    };
  }

  function statsHoldFromPayload(payload) {
    if (!payload || isPlaceholder(payload)) return null;
    const krSignals = mergeRegionSignals(payload, KR_KEYS);
    const usSignals = mergeRegionSignals(payload, US_KEYS);
    const build = (signals) => {
      const out = {};
      for (const day of HOLD_DAYS) {
        out[`day${day}`] = computeHoldReturnStats(signals, day);
      }
      return out;
    };
    return { kr: build(krSignals), us: build(usSignals) };
  }

  function formatMatchRate(ratePct) {
    if (ratePct == null || !Number.isFinite(ratePct)) return "—";
    return `${ratePct.toFixed(1)}%`;
  }

  function formatReturnSum(returnSumPct) {
    if (returnSumPct == null || !Number.isFinite(returnSumPct)) return "—";
    const sign = returnSumPct > 0 ? "+" : "";
    return `${sign}${returnSumPct.toFixed(1)}%`;
  }

  function rateClass(ratePct) {
    if (ratePct == null || !Number.isFinite(ratePct)) return "neutral";
    return ratePct >= 50 ? "up" : "down";
  }

  function returnSumClass(returnSumPct) {
    if (returnSumPct == null || !Number.isFinite(returnSumPct)) return "neutral";
    return returnSumPct > 0 ? "up" : returnSumPct < 0 ? "down" : "neutral";
  }

  function aggregateAccuracyBlock(tickers, field) {
    let total = 0;
    let matched = 0;
    for (const row of Object.values(tickers || {})) {
      const acc = row?.[field];
      if (!acc) continue;
      total += Number(acc.total) || 0;
      matched += Number(acc.matched) || 0;
    }
    const ratePct = total > 0 ? (matched / total) * 100 : null;
    return {
      match: matched,
      mismatch: total - matched,
      total,
      ratePct,
      pending: 0
    };
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function fetchApiStrategy(apiPath) {
    const base = getApiBase();
    if (!base || !apiPath) return null;
    try {
      const res = await fetch(`${base}${apiPath}`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.strategy || null;
    } catch {
      return null;
    }
  }

  function readCachedPayload(item) {
    if (item.dataKey) {
      const layer = window.StockStrategyData?.[item.dataKey];
      const cached = layer?.readBestCache?.();
      if (cached && !isPlaceholder(cached)) return cached;
      return null;
    }
    if (item.id === "recommend2") {
      const cached = window.Recommend2Data?.readSessionCache?.();
      if (cached && !isPlaceholder(cached)) return cached;
    }
    return null;
  }

  async function loadStaticJsonPayload(item) {
    const url = resolveStaticJsonUrl(item);
    if (!url) return null;
    try {
      const json = await fetchJson(url);
      return json && !isPlaceholder(json) ? json : null;
    } catch {
      return null;
    }
  }

  async function loadTechnicalPayloadRemote(item) {
    const staticJson = await loadStaticJsonPayload(item);

    if (item.dataKey && window.StockStrategyData?.[item.dataKey]?.load) {
      try {
        const remote = await window.StockStrategyData[item.dataKey].load({ preferCache: true });
        if (remote && !isPlaceholder(remote)) {
          return staticJson ? mergeHoldFieldsFromSource(remote, staticJson) : remote;
        }
      } catch {
        /* fall through */
      }
    }
    if (item.id === "recommend2") {
      const cached = readCachedPayload(item);
      try {
        const snap = await window.Recommend2Data?.fetchSnapshot?.();
        if (snap && !isPlaceholder(snap)) {
          return staticJson ? mergeHoldFieldsFromSource(snap, staticJson) : snap;
        }
      } catch {
        /* fall through */
      }
      if (staticJson) return staticJson;
      return cached;
    }
    if (staticJson) return staticJson;
    return null;
  }

  function aggregateReturnBlock(summaries) {
    let sum = 0;
    let count = 0;
    let up = 0;
    let down = 0;
    let hasAny = false;
    for (const data of summaries || []) {
      const block = data?.return14d;
      if (!block || block.returnSumPct == null) continue;
      hasAny = true;
      sum += Number(block.returnSumPct);
      count += Number(block.returnCount) || 0;
      up += Number(block.returnUp) || 0;
      down += Number(block.returnDown) || 0;
    }
    return {
      returnSumPct: hasAny ? Math.round(sum * 10) / 10 : null,
      returnCount: count,
      returnUp: up,
      returnDown: down
    };
  }

  function aggregateHoldReturnBlock(summaries) {
    const out = {};
    for (const day of HOLD_DAYS) {
      let sum = 0;
      let count = 0;
      let hasAny = false;
      for (const data of summaries || []) {
        const block = data?.holdReturn14d?.[`holdDay${day}`];
        if (!block || block.returnSumPct == null) continue;
        hasAny = true;
        sum += Number(block.returnSumPct);
        count += Number(block.returnCount) || 0;
      }
      out[`day${day}`] = {
        returnSumPct: hasAny ? Math.round(sum * 10) / 10 : null,
        returnCount: count
      };
    }
    return out;
  }

  async function loadSentimentStats() {
    const base = getApiBase();
    if (!base) {
      const empty = {
        match: 0,
        mismatch: 0,
        total: 0,
        ratePct: null,
        pending: 0,
        returnSumPct: null,
        returnCount: 0,
        returnUp: 0,
        returnDown: 0
      };
      const emptyHold = () => {
        const o = {};
        for (const day of HOLD_DAYS) {
          o[`day${day}`] = { returnSumPct: null, returnCount: 0 };
        }
        return o;
      };
      return { kr: { ...empty, hold: emptyHold() }, us: { ...empty, hold: emptyHold() }, error: "API 연결 없음" };
    }
    const krMarkets = ["kr_kospi", "kr_kosdaq"];
    const usMarkets = ["us"];

    async function loadGroup(markets) {
      const responses = await Promise.all(
        markets.map(async (market) => {
          try {
            const res = await fetch(
              `${base}/api/predictions/summary?market=${encodeURIComponent(market)}&days=14`,
              { cache: "no-store" }
            );
            if (!res.ok) return { tickers: {}, return14d: null, holdReturn14d: null };
            return res.json();
          } catch {
            return { tickers: {}, return14d: null, holdReturn14d: null };
          }
        })
      );
      const merged = {};
      for (const data of responses) {
        Object.assign(merged, data.tickers || {});
      }
      return {
        ...aggregateAccuracyBlock(merged, "accuracy14d"),
        ...aggregateReturnBlock(responses),
        hold: aggregateHoldReturnBlock(responses)
      };
    }

    const [kr, us] = await Promise.all([loadGroup(krMarkets), loadGroup(usMarkets)]);
    return { kr, us };
  }

  function strategyFromItemOrPayload(item, payload) {
    if (strategyLooksComplete(item.strategy)) return item.strategy;
    if (strategyLooksComplete(payload?.strategy)) return payload.strategy;
    return item.strategy || payload?.strategy || null;
  }

  function renderRegionCells(stats, pendingNote) {
    const rateCls = rateClass(stats.ratePct);
    const retCls = returnSumClass(stats.returnSumPct);
    const pending =
      stats.pending > 0
        ? `<span class="recommend2-match-pending"> · 대기 ${stats.pending}</span>`
        : pendingNote || "";
    return `
      <td class="recommend2-match-hit">${stats.match}건</td>
      <td class="recommend2-match-miss">${stats.mismatch}건</td>
      <td class="recommend2-match-rate recommend2-match-rate--${rateCls}">${escapeHtml(formatMatchRate(stats.ratePct))}</td>
      <td class="recommend2-match-rate recommend2-match-rate--${retCls}">${escapeHtml(formatReturnSum(stats.returnSumPct))}</td>
      <td class="recommend2-match-total">${stats.total}건${pending}</td>`;
  }

  function renderLoadingRegionCells(label) {
    return `<td class="stock-formulas-cell-loading" colspan="5" aria-busy="true">${escapeHtml(label)}</td>`;
  }

  const STICKY_COL_CLASS = "stock-formulas-sticky-col";

  function renderCompareTableShell() {
    const body = COMPARE_ITEMS.map((item) => {
      const isSentiment = item.kind === "sentiment";
      const cached = isSentiment ? null : readCachedPayload(item);
      const stats = cached ? statsFromPayload(cached) : null;
      let cells;
      if (stats) {
        cells = `${renderRegionCells(stats.kr)}${renderRegionCells(stats.us)}`;
      } else if (isSentiment) {
        cells = `${renderLoadingRegionCells("API…")}${renderLoadingRegionCells("API…")}`;
      } else {
        cells = `${renderLoadingRegionCells("…")}${renderLoadingRegionCells("…")}`;
      }
      return `
        <tr data-formula-id="${escapeHtml(item.id)}"${stats ? "" : ' data-formula-pending="1"'}>
          <th scope="row" class="${STICKY_COL_CLASS}">${escapeHtml(item.label)}</th>
          ${cells}
        </tr>`;
    }).join("");

    return `
      <section class="recommend2-match-summary stock-formulas-compare" aria-label="최근 14일 성과 비교">
        <p class="recommend2-match-summary-title">
          <strong>최근 14일 성과</strong> · 한국장 = KOSPI+KOSDAQ · 미국장 = NASDAQ+NYSE 합산
          <span id="stock-formulas-compare-status" class="stock-formulas-compare-status" hidden aria-live="polite"></span>
        </p>
        <p class="stock-formulas-compare-note">
          기술 전략: 신호 발생 익거래일 <strong>상승=일치</strong> · 하락·보합=불일치 ·
          감성뉴스: 장 시작 전 예측 대비 <strong>익일 종가 적중</strong> (관망 ±0.5%) ·
          수익률: 추천일 종가 매입 · <strong>1일차(익일)</strong> 수익률(%) <strong>합산</strong> (보유일 1일차와 동일 · 예: +5%, −1%, −1% → +3%)
        </p>
        <div class="recommend2-backtest-table-wrap">
          <table class="recommend2-match-table stock-formulas-compare-table">
            <thead>
              <tr>
                <th scope="col" rowspan="2" class="${STICKY_COL_CLASS}">추천 방식</th>
                <th scope="colgroup" colspan="5">한국장</th>
                <th scope="colgroup" colspan="5">미국장</th>
              </tr>
              <tr>
                <th scope="col">일치</th>
                <th scope="col">불일치</th>
                <th scope="col">일치율</th>
                <th scope="col">수익률</th>
                <th scope="col">건수</th>
                <th scope="col">일치</th>
                <th scope="col">불일치</th>
                <th scope="col">일치율</th>
                <th scope="col">수익률</th>
                <th scope="col">건수</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </section>`;
  }

  function renderHoldReturnCells(regionStats) {
    return HOLD_DAYS.map((day) => {
      const block = regionStats?.[`day${day}`] || {};
      const cls = returnSumClass(block.returnSumPct);
      const colorCls =
        cls === "up" ? "recommend2-return-up" : cls === "down" ? "recommend2-return-down" : "";
      const count =
        block.returnCount > 0
          ? `<span class="recommend2-match-pending"> · ${block.returnCount}건</span>`
          : "";
      return `<td class="stock-formulas-hold-value ${colorCls}">${escapeHtml(formatReturnSum(block.returnSumPct))}${count}</td>`;
    }).join("");
  }

  function renderHoldLoadingRegion(label) {
    return `<td class="stock-formulas-cell-loading" colspan="${HOLD_DAYS.length}" aria-busy="true">${escapeHtml(label)}</td>`;
  }

  function renderHoldCompareTableShell() {
    const body = COMPARE_ITEMS.map((item) => {
      const isSentiment = item.kind === "sentiment";
      const cached = isSentiment ? null : readCachedPayload(item);
      const holdStats = cached ? statsHoldFromPayload(cached) : null;
      let cells;
      if (holdStats) {
        cells = `${renderHoldReturnCells(holdStats.kr)}${renderHoldReturnCells(holdStats.us)}`;
      } else if (isSentiment) {
        cells = `${renderHoldLoadingRegion("API…")}${renderHoldLoadingRegion("API…")}`;
      } else {
        cells = `${renderHoldLoadingRegion("…")}${renderHoldLoadingRegion("…")}`;
      }
      return `
        <tr data-formula-id="${escapeHtml(item.id)}" data-formula-hold="1"${holdStats ? "" : ' data-formula-pending="1"'}>
          <th scope="row" class="${STICKY_COL_CLASS}">${escapeHtml(item.label)}</th>
          ${cells}
        </tr>`;
    }).join("");

    return `
      <section class="recommend2-match-summary stock-formulas-hold-compare" aria-label="최근 14일 보유일 수익률">
        <p class="recommend2-match-summary-title">
          <strong>일별 보유 수익률 (1~5일차)</strong> · 최근 14일 · 한국장 / 미국장 합산
        </p>
        <p class="stock-formulas-compare-note">
          매입: 추천일(<strong>신호일</strong>) <strong>종가</strong> ·
          <strong>N일차</strong>: 매입 후 N번째 거래일 종가에 매도 (1일차=익일, 14일 성과 수익률과 동일) ·
          수익률: 신호별 N일차 수익률(%) <strong>합산</strong> (동일 기간 신호 건수 합산 · 포트폴리오 수익률 아님) ·
          (예: 7/5 추천 → 7/5 종가 매입 · 1일차 = 7/6 종가 · 2일차 = 7/7 종가)
        </p>
        <div class="recommend2-backtest-table-wrap">
          <table class="recommend2-match-table stock-formulas-hold-table">
            <thead>
              <tr>
                <th scope="col" rowspan="2" class="${STICKY_COL_CLASS}">추천 방식</th>
                <th scope="colgroup" colspan="${HOLD_DAYS.length}">한국장</th>
                <th scope="colgroup" colspan="${HOLD_DAYS.length}">미국장</th>
              </tr>
              <tr>
                ${HOLD_DAYS.map((d) => `<th scope="col">${d}일차</th>`).join("")}
                ${HOLD_DAYS.map((d) => `<th scope="col">${d}일차</th>`).join("")}
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </section>`;
  }

  function setCompareStatus(container, text, visible) {
    const el = container.querySelector("#stock-formulas-compare-status");
    if (!el) return;
    el.textContent = text || "";
    el.hidden = !visible;
  }

  function updateCompareRow(container, itemId, krStats, usStats, notes) {
    const row = container.querySelector(`tr[data-formula-id="${itemId}"]`);
    if (!row) return;
    const krNote = notes?.krNote || "";
    const usNote = notes?.usNote || "";
    row.innerHTML = `
      <th scope="row" class="${STICKY_COL_CLASS}">${escapeHtml(FORMULA_ITEMS.find((i) => i.id === itemId)?.label || itemId)}</th>
      ${renderRegionCells(krStats, krNote)}
      ${renderRegionCells(usStats, usNote)}`;
    row.removeAttribute("data-formula-pending");
  }

  function updateHoldCompareRow(container, itemId, krHold, usHold) {
    const row = container.querySelector(`tr[data-formula-id="${itemId}"][data-formula-hold="1"]`);
    if (!row) return;
    row.innerHTML = `
      <th scope="row" class="${STICKY_COL_CLASS}">${escapeHtml(FORMULA_ITEMS.find((i) => i.id === itemId)?.label || itemId)}</th>
      ${renderHoldReturnCells(krHold)}
      ${renderHoldReturnCells(usHold)}`;
    row.removeAttribute("data-formula-pending");
  }

  function renderStrategySection(item, strategy) {
    if (!strategy) {
      return `
        <section class="stock-formulas-method" id="formula-${escapeHtml(item.id)}" data-formula-section="${escapeHtml(item.id)}">
          <h3 class="recommend2-strategy-title">${escapeHtml(item.label)}</h3>
          <p class="recommend2-empty">전략 설명을 불러오지 못했습니다.</p>
          <p><button type="button" class="secondary-btn stock-formulas-goto" data-page="${escapeHtml(item.pageId)}">${escapeHtml(item.label)} 탭으로 이동</button></p>
        </section>`;
    }

    const rules = (strategy.rules || [])
      .map((r) => `<li>${escapeHtml(r)}</li>`)
      .join("");
    const patterns = (strategy.patterns || [])
      .map(
        (p) =>
          `<div class="recommend2-pattern-card"><strong>${escapeHtml(p.label)}</strong><p>${escapeHtml(p.description)}</p></div>`
      )
      .join("");
    const bt = strategy.backtest;
    const backtestHtml = bt
      ? `
        <div class="recommend2-backtest">
          <p class="recommend2-backtest-title">백테스트 (${escapeHtml(bt.period || "6개월")} · ${escapeHtml(bt.universe || "")})</p>
          <table class="recommend2-backtest-table">
            <thead>
              <tr>
                <th>패턴</th>
                <th>신호</th>
                <th>상승비율</th>
                <th>평균 수익</th>
                <th>상승일</th>
                <th>하락일</th>
              </tr>
            </thead>
            <tbody>
              ${["A", "B"]
                .filter((key) => bt[key])
                .map((key) => {
                  const row = bt[key];
                  const label =
                    key === "A"
                      ? strategy.patterns?.[0]?.label || "패턴 A"
                      : strategy.patterns?.[1]?.label || "패턴 B";
                  return `
                <tr>
                  <td>${escapeHtml(label)}</td>
                  <td>${escapeHtml(String(row.signals ?? "—"))}건</td>
                  <td>${escapeHtml(row.winRate ?? "—")}</td>
                  <td>${escapeHtml(row.avgReturn ?? "—")}</td>
                  <td>${escapeHtml(row.upDayAvg ?? "—")}</td>
                  <td>${escapeHtml(row.downDayAvg ?? "—")}</td>
                </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>`
      : "";

    return `
      <section class="stock-formulas-method recommend2-strategy-box" id="formula-${escapeHtml(item.id)}" data-formula-section="${escapeHtml(item.id)}">
        <div class="stock-formulas-method-head">
          <h3 class="recommend2-strategy-title">${escapeHtml(strategy.title || item.label)}</h3>
          <button type="button" class="secondary-btn stock-formulas-goto" data-page="${escapeHtml(item.pageId)}">이 전략 보기 →</button>
        </div>
        <p class="recommend2-strategy-universe">${escapeHtml(strategy.universe || "")}</p>
        <p class="recommend2-strategy-summary">${escapeHtml(strategy.summary || "")}</p>
        ${rules ? `<ol class="recommend2-strategy-rules">${rules}</ol>` : ""}
        ${patterns ? `<div class="recommend2-pattern-grid">${patterns}</div>` : ""}
        ${backtestHtml}
        ${strategy.disclaimer ? `<p class="recommend2-disclaimer">${escapeHtml(String(strategy.disclaimer))}</p>` : ""}
      </section>`;
  }

  function bindGotoButtons(root) {
    root.querySelectorAll(".stock-formulas-goto").forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = btn.dataset.page;
        if (!page) return;
        if (window.AppNavigation?.navigate) {
          window.AppNavigation.navigate({ page });
        } else {
          const base = location.pathname.indexOf("/First") !== -1 ? "/First/" : "/";
          location.href = `${base}?page=${encodeURIComponent(page)}`;
        }
      });
    });
  }

  function replaceStrategySection(container, item, strategy) {
    const existing = container.querySelector(`[data-formula-section="${item.id}"]`);
    if (!existing) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = renderStrategySection(item, strategy);
    const next = wrap.firstElementChild;
    if (next) existing.replaceWith(next);
  }

  function applyPayloadToRow(container, item, payload, gen) {
    if (gen !== renderGeneration) return;
    const stats = statsFromPayload(payload);
    if (stats) updateCompareRow(container, item.id, stats.kr, stats.us);
    const holdStats = statsHoldFromPayload(payload);
    if (holdStatsHasData(holdStats)) {
      updateHoldCompareRow(container, item.id, holdStats.kr, holdStats.us);
    }
  }

  async function hydrateHoldRowsFromJson(compareMount, gen) {
    const pending = COMPARE_ITEMS.filter((item) => item.kind !== "sentiment");
    await Promise.all(
      pending.map(async (item) => {
        const url = resolveStaticJsonUrl(item);
        if (!url) return;
        try {
          const json = await fetchJson(url);
          if (gen !== renderGeneration) return;
          const holdStats = statsHoldFromPayload(json);
          if (holdStatsHasData(holdStats)) {
            updateHoldCompareRow(compareMount, item.id, holdStats.kr, holdStats.us);
          }
        } catch {
          /* noop */
        }
      })
    );
  }

  async function hydrateJsonRows(compareMount, methodsMount, gen) {
    const pending = FORMULA_ITEMS.filter(
      (item) =>
        item.kind !== "sentiment" &&
        item.kind !== "fundamentals" &&
        !readCachedPayload(item) &&
        resolveStaticJsonUrl(item)
    );
    if (!pending.length) return;

    const panel = compareMount.closest(".stock-formulas-panel") || compareMount;

    await Promise.all(
      pending.map(async (item) => {
        try {
          const json = await loadStaticJsonPayload(item);
          if (!json || gen !== renderGeneration) return;
          applyPayloadToRow(compareMount, item, json, gen);
          const strategy = strategyFromItemOrPayload(item, json);
          if (strategyLooksComplete(strategy)) {
            replaceStrategySection(methodsMount, item, strategy);
            bindGotoButtons(panel);
          }
        } catch {
          /* noop */
        }
      })
    );
  }

  async function hydrateRemoteRows(compareMount, methodsMount, gen) {
    const pending = FORMULA_ITEMS.filter((item) => {
      if (item.kind === "sentiment" || item.kind === "fundamentals") return false;
      const row = compareMount.querySelector(`tr[data-formula-id="${item.id}"]`);
      return row?.hasAttribute("data-formula-pending");
    });

    if (!pending.length) return;

    const panel = compareMount.closest(".stock-formulas-panel") || compareMount;

    await Promise.all(
      pending.map(async (item) => {
        const payload = await loadTechnicalPayloadRemote(item);
        if (gen !== renderGeneration) return;
        if (payload) {
          applyPayloadToRow(compareMount, item, payload, gen);
          const strategy = strategyFromItemOrPayload(item, payload);
          if (strategyLooksComplete(strategy)) {
            replaceStrategySection(methodsMount, item, strategy);
            bindGotoButtons(panel);
          }
        } else {
          const row = compareMount.querySelector(`tr[data-formula-id="${item.id}"]`);
          if (row) row.removeAttribute("data-formula-pending");
        }
      })
    );
  }

  async function hydrateSentimentRow(container, gen) {
    setCompareStatus(container, "· 감성뉴스 API 갱신 중", true);
    try {
      const result = await loadSentimentStats();
      if (gen !== renderGeneration) return;
      const krNote = result.error
        ? `<span class="recommend2-match-pending"> · ${escapeHtml(result.error)}</span>`
        : "";
      updateCompareRow(container, "sentiment", result.kr, result.us, { krNote, usNote: "" });
      updateHoldCompareRow(container, "sentiment", result.kr.hold, result.us.hold);
    } finally {
      if (gen === renderGeneration) setCompareStatus(container, "", false);
    }
  }

  async function enrichIncompleteStrategies(methodsMount, gen) {
    const panel = methodsMount.closest(".stock-formulas-panel") || methodsMount;

    for (const item of FORMULA_ITEMS) {
      if (item.kind === "fundamentals") continue;
      if (strategyLooksComplete(item.strategy)) continue;

      const cached = readCachedPayload(item);
      if (strategyLooksComplete(cached?.strategy)) {
        replaceStrategySection(methodsMount, item, cached.strategy);
        continue;
      }

      const fromApi = await fetchApiStrategy(item.apiPath);
      if (gen !== renderGeneration) return;
      if (strategyLooksComplete(fromApi)) {
        replaceStrategySection(methodsMount, item, fromApi);
      }
    }

    bindGotoButtons(panel);
  }

  function renderInitialStrategySections(container) {
    const html = FORMULA_ITEMS.map((item) => {
      const cached = readCachedPayload(item);
      const strategy = strategyFromItemOrPayload(item, cached);
      return renderStrategySection(item, strategy);
    }).join("");
    container.innerHTML = `
      <h3 class="recommend2-section-label">추천 방식 상세</h3>
      ${html}`;
  }

  function renderNotificationsPanel() {
    return `
      <section class="stock-formulas-notify" id="stock-formulas-notify" aria-label="추천 알림 설정">
        <h3 class="recommend2-section-label">추천 알림</h3>
        <p class="stock-formulas-notify-intro">
          한국 <strong>06:50</strong> record · <strong>07:08</strong> 푸시 · 미국 <strong>08:00 (ET)</strong> 추천 반영 후 9공식 이름과 종목을 푸시합니다.
          관망 종목은 제외 · 기술 전략은 전일 18:00 스냅샷 기준 ·
          <strong>PER·ROE·PBR·배당 TOP20은 알림에 포함되지 않습니다</strong> · 지역별 활성화 <strong>1 DM</strong>
        </p>
        <div class="stock-formulas-notify-grid">
          <div class="stock-formulas-notify-card" data-region="kr">
            <div class="stock-formulas-notify-card-head">
              <strong>한국장 알림</strong>
              <label class="stock-formulas-notify-toggle">
                <input type="checkbox" id="stock-notify-kr" data-region="kr" />
                <span>켜기</span>
              </label>
            </div>
            <button type="button" class="secondary-btn stock-formulas-notify-test" data-test-region="kr">지금 테스트 발송</button>
          </div>
          <div class="stock-formulas-notify-card" data-region="us">
            <div class="stock-formulas-notify-card-head">
              <strong>미국장 알림</strong>
              <label class="stock-formulas-notify-toggle">
                <input type="checkbox" id="stock-notify-us" data-region="us" />
                <span>켜기</span>
              </label>
            </div>
            <button type="button" class="secondary-btn stock-formulas-notify-test" data-test-region="us">지금 테스트 발송</button>
          </div>
        </div>
        <p id="stock-formulas-notify-status" class="stock-formulas-notify-status" aria-live="polite"></p>
      </section>`;
  }

  function setNotifyStatus(root, text, kind) {
    const el = root.querySelector("#stock-formulas-notify-status");
    if (!el) return;
    el.textContent = text || "";
    el.className = `stock-formulas-notify-status${kind ? ` stock-formulas-notify-status--${kind}` : ""}`;
  }

  async function refreshNotificationUi(root) {
    const api = window.StockNotifications;
    if (!api) {
      setNotifyStatus(root, "알림 모듈을 불러오지 못했습니다.", "error");
      return;
    }
    const krBox = root.querySelector("#stock-notify-kr");
    const usBox = root.querySelector("#stock-notify-us");
    if (!krBox || !usBox) return;

    if (!window.Auth?.getSession?.()) {
      setNotifyStatus(root, "알림 설정은 로그인 후 사용할 수 있습니다.", "info");
      krBox.disabled = true;
      usBox.disabled = true;
      return;
    }

    if (!api.supportsPush()) {
      setNotifyStatus(
        root,
        "Web Push 미지원 환경입니다. Chrome·Edge PWA(홈 화면 추가)를 권장합니다.",
        "warn"
      );
    }

    try {
      const status = await api.getStatus();
      krBox.checked = !!status.krEnabled;
      usBox.checked = !!status.usEnabled;
      krBox.disabled = false;
      usBox.disabled = false;
      if (!status.vapidConfigured) {
        setNotifyStatus(root, "서버 Push 설정(VAPID)이 아직 없습니다. Render 환경 변수를 확인하세요.", "warn");
      } else if (status.krEnabled || status.usEnabled) {
        const parts = ["알림이 설정되었습니다. 한국 06:50 record · 07:08 푸시 (GitHub Actions → Render)."];
        try {
          if (status.krEnabled) {
            const row = await api.getLastDigest("kr");
            const line = api.formatDigestLog(row);
            if (line) parts.push(`한국장 마지막 정기 발송: ${line}`);
          }
          if (status.usEnabled) {
            const row = await api.getLastDigest("us");
            const line = api.formatDigestLog(row);
            if (line) parts.push(`미국장 마지막 정기 발송: ${line}`);
          }
        } catch {
          /* ignore */
        }
        setNotifyStatus(root, parts.join(" "), "ok");
      } else {
        setNotifyStatus(root, "켜려는 지역을 선택하세요. 각 1 DM이 차감됩니다.", "info");
      }
    } catch (err) {
      setNotifyStatus(root, err.message || "상태 조회 실패", "error");
    }
  }

  function bindNotifications(root) {
    const api = window.StockNotifications;
    if (!api) return;

    root.querySelectorAll('input[type="checkbox"][data-region]').forEach((input) => {
      input.addEventListener("change", async () => {
        const region = input.dataset.region;
        const label = api.REGION_LABELS[region] || region;
        input.disabled = true;
        try {
          if (input.checked) {
            const result = await api.subscribeRegion(region);
            const dmNote = result?.dmSpent ? " (DM 1 사용)" : "";
            setNotifyStatus(root, `${label} 알림을 켰습니다.${dmNote}`, "ok");
          } else {
            await api.disableRegion(region);
            setNotifyStatus(root, `${label} 알림을 껐습니다.`, "info");
          }
          await refreshNotificationUi(root);
        } catch (err) {
          input.checked = !input.checked;
          setNotifyStatus(root, err.message || "설정 실패", "error");
        } finally {
          input.disabled = false;
        }
      });
    });

    root.querySelectorAll(".stock-formulas-notify-test").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const region = btn.dataset.testRegion;
        const label = api.REGION_LABELS[region] || region;
        btn.disabled = true;
        setNotifyStatus(root, `${label} 테스트 발송 중…`, "info");
        try {
          await api.sendTest(region);
          setNotifyStatus(root, `${label} 테스트 알림을 보냈습니다.`, "ok");
        } catch (err) {
          setNotifyStatus(root, err.message || "테스트 발송 실패", "error");
        } finally {
          btn.disabled = false;
        }
      });
    });

    void refreshNotificationUi(root);
  }

  function renderPage(container) {
    const gen = ++renderGeneration;

    container.innerHTML = `
      <article class="content-panel recommend2-panel stock-formulas-panel">
        <div id="stock-formulas-nav-mount"></div>
        <header class="recommend2-header">
          <h2>단기추천로직</h2>
          <p class="recommend2-intro">Stock Picks의 9가지 단기 추천 방식을 한곳에서 비교합니다. 상단 표는 최근 14일 일치율·수익률(합산)이며, 아래에서 각 로직을 자세히 설명합니다.</p>
        </header>
        ${renderUpdateScheduleSection()}
        <p class="stock-page-updated">갱신 시간은 각 로직 탭 상단에서 확인 · <span class="stock-page-updated-at">비교 표는 로드 후 갱신</span></p>
        <div id="stock-formulas-notify-mount"></div>
        <div id="stock-formulas-compare-mount"></div>
        <div id="stock-formulas-methods-mount"></div>
      </article>`;

    window.StockStrategyNav?.mount?.(container.querySelector("#stock-formulas-nav-mount"), "stock-picks-formulas");

    const compareMount = container.querySelector("#stock-formulas-compare-mount");
    const methodsMount = container.querySelector("#stock-formulas-methods-mount");
    const notifyMount = container.querySelector("#stock-formulas-notify-mount");

    if (notifyMount) {
      notifyMount.innerHTML = renderNotificationsPanel();
      bindNotifications(container);
    }

    compareMount.innerHTML = renderCompareTableShell() + renderHoldCompareTableShell();
    renderInitialStrategySections(methodsMount);
    bindGotoButtons(container);

    void hydrateHoldRowsFromJson(compareMount, gen);
    void hydrateJsonRows(compareMount, methodsMount, gen);
    void hydrateRemoteRows(compareMount, methodsMount, gen);
    void hydrateSentimentRow(compareMount, gen);
    void enrichIncompleteStrategies(methodsMount, gen);
  }

  window.StockPicksFormulas = { renderPage };
})();
