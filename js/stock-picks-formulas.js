/**
 * Stock Picks — 추천공식 (전략 설명 + 14일 성과 비교, 점진적 로딩)
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
          "점수 = 호재 건수 × 3 − 악재 건수 × 2",
          "추천: 점수 ≥ 4 · 주의: 악재 2건 이상이고 호재보다 많음 · 그 외 관망",
          "매일 장 시작 전(한국 08:00 KST / 미국 08:00 ET) 예측 저장",
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
    }
  ];

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
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
    return {
      kr: computeMatchStats(mergeRegionSignals(payload, KR_KEYS)),
      us: computeMatchStats(mergeRegionSignals(payload, US_KEYS))
    };
  }

  function formatMatchRate(ratePct) {
    if (ratePct == null || !Number.isFinite(ratePct)) return "—";
    return `${ratePct.toFixed(1)}%`;
  }

  function rateClass(ratePct) {
    if (ratePct == null || !Number.isFinite(ratePct)) return "neutral";
    return ratePct >= 50 ? "up" : "down";
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

  async function loadTechnicalPayloadRemote(item) {
    if (item.dataKey && window.StockStrategyData?.[item.dataKey]?.load) {
      try {
        return await window.StockStrategyData[item.dataKey].load({ preferCache: true });
      } catch {
        /* fall through */
      }
    }
    if (item.id === "recommend2") {
      const cached = readCachedPayload(item);
      try {
        const snap = await window.Recommend2Data?.fetchSnapshot?.();
        if (snap && !isPlaceholder(snap)) return snap;
      } catch {
        /* fall through */
      }
      if (item.jsonUrl) {
        try {
          const json = await fetchJson(item.jsonUrl);
          if (json && !isPlaceholder(json)) return json;
        } catch {
          /* fall through */
        }
      }
      return cached;
    }
    if (item.jsonUrl) {
      try {
        return await fetchJson(item.jsonUrl);
      } catch {
        return null;
      }
    }
    return null;
  }

  async function loadSentimentStats() {
    const base = getApiBase();
    if (!base) {
      return {
        kr: { match: 0, mismatch: 0, total: 0, ratePct: null, pending: 0 },
        us: { match: 0, mismatch: 0, total: 0, ratePct: null, pending: 0 },
        error: "API 연결 없음"
      };
    }
    const krMarkets = ["kr_kospi", "kr_kosdaq"];
    const usMarkets = ["us"];

    async function loadGroup(markets) {
      const blocks = await Promise.all(
        markets.map(async (market) => {
          try {
            const res = await fetch(
              `${base}/api/predictions/summary?market=${encodeURIComponent(market)}&days=14`,
              { cache: "no-store" }
            );
            if (!res.ok) return {};
            const data = await res.json();
            return data.tickers || {};
          } catch {
            return {};
          }
        })
      );
      const merged = {};
      for (const block of blocks) {
        Object.assign(merged, block);
      }
      return aggregateAccuracyBlock(merged, "accuracy14d");
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
    const pending =
      stats.pending > 0
        ? `<span class="recommend2-match-pending"> · 대기 ${stats.pending}</span>`
        : pendingNote || "";
    return `
      <td class="recommend2-match-hit">${stats.match}건</td>
      <td class="recommend2-match-miss">${stats.mismatch}건</td>
      <td class="recommend2-match-rate recommend2-match-rate--${rateCls}">${escapeHtml(formatMatchRate(stats.ratePct))}</td>
      <td class="recommend2-match-total">${stats.total}건${pending}</td>`;
  }

  function renderLoadingRegionCells(label) {
    return `<td class="stock-formulas-cell-loading" colspan="4" aria-busy="true">${escapeHtml(label)}</td>`;
  }

  function renderCompareTableShell() {
    const body = FORMULA_ITEMS.map((item) => {
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
          <th scope="row">${escapeHtml(item.label)}</th>
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
          감성뉴스: 장 시작 전 예측 대비 <strong>익일 종가 적중</strong> (관망 ±0.5%)
        </p>
        <div class="recommend2-backtest-table-wrap">
          <table class="recommend2-match-table stock-formulas-compare-table">
            <thead>
              <tr>
                <th scope="col" rowspan="2">추천 방식</th>
                <th scope="colgroup" colspan="4">한국장</th>
                <th scope="colgroup" colspan="4">미국장</th>
              </tr>
              <tr>
                <th scope="col">일치</th>
                <th scope="col">불일치</th>
                <th scope="col">일치율</th>
                <th scope="col">건수</th>
                <th scope="col">일치</th>
                <th scope="col">불일치</th>
                <th scope="col">일치율</th>
                <th scope="col">건수</th>
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
      <th scope="row">${escapeHtml(FORMULA_ITEMS.find((i) => i.id === itemId)?.label || itemId)}</th>
      ${renderRegionCells(krStats, krNote)}
      ${renderRegionCells(usStats, usNote)}`;
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
    if (!stats) return;
    updateCompareRow(container, item.id, stats.kr, stats.us);
  }

  async function hydrateJsonRows(compareMount, methodsMount, gen) {
    const pending = FORMULA_ITEMS.filter(
      (item) => item.kind !== "sentiment" && !readCachedPayload(item) && item.jsonUrl
    );
    if (!pending.length) return;

    const panel = compareMount.closest(".stock-formulas-panel") || compareMount;

    await Promise.all(
      pending.map(async (item) => {
        try {
          const json = await fetchJson(item.jsonUrl);
          if (gen !== renderGeneration) return;
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
      if (item.kind === "sentiment") return false;
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
    } finally {
      if (gen === renderGeneration) setCompareStatus(container, "", false);
    }
  }

  async function enrichIncompleteStrategies(methodsMount, gen) {
    const panel = methodsMount.closest(".stock-formulas-panel") || methodsMount;

    for (const item of FORMULA_ITEMS) {
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

  function renderPage(container) {
    const gen = ++renderGeneration;

    container.innerHTML = `
      <article class="content-panel recommend2-panel stock-formulas-panel">
        <div id="stock-formulas-nav-mount"></div>
        <header class="recommend2-header">
          <h2>추천공식</h2>
          <p class="recommend2-intro">Stock Picks의 9가지 추천 방식을 한곳에서 비교합니다. 상단 표는 최근 14일 성과이며, 아래에서 각 공식의 로직을 자세히 설명합니다.</p>
        </header>
        <div id="stock-formulas-compare-mount"></div>
        <div id="stock-formulas-methods-mount"></div>
      </article>`;

    window.StockStrategyNav?.mount?.(container.querySelector("#stock-formulas-nav-mount"), "stock-picks-formulas");

    const compareMount = container.querySelector("#stock-formulas-compare-mount");
    const methodsMount = container.querySelector("#stock-formulas-methods-mount");

    compareMount.innerHTML = renderCompareTableShell();
    renderInitialStrategySections(methodsMount);
    bindGotoButtons(container);

    void hydrateJsonRows(compareMount, methodsMount, gen);
    void hydrateRemoteRows(compareMount, methodsMount, gen);
    void hydrateSentimentRow(compareMount, gen);
    void enrichIncompleteStrategies(methodsMount, gen);
  }

  window.StockPicksFormulas = { renderPage };
})();
