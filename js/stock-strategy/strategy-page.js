/**
 * Stock strategy pages — 골든크로스 / 볼린저 / RSI (DM 1 · 바닥매집 UI 패턴)
 */
(function () {
  const NY_TZ = "America/New_York";

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

  function formatPct(value) {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    const n = Number(value);
    const sign = n > 0 ? "+" : "";
    return `${sign}${n.toFixed(2)}%`;
  }

  function formatPrice(value, currency) {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    const n = Number(value);
    if (currency === "USD") {
      return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}원`;
  }

  function formatUpdatedNy(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ko-KR", {
      timeZone: NY_TZ,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short"
    });
  }

  function formatShortDate(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso || "—";
    return `${Number(m[2])}/${Number(m[3])}`;
  }

  function isKrTicker(ticker) {
    return /\.(KS|KQ)$/i.test(String(ticker || ""));
  }

  function stockLink(ticker) {
    const kr = String(ticker || "").match(/^(\d{6})\.(KS|KQ)$/i);
    if (kr) return `https://finance.naver.com/item/main.naver?code=${kr[1]}`;
    const sym = String(ticker || "").replace(/\.(KS|KQ)$/i, "");
    if (/^[A-Z][A-Z0-9.\-]{0,9}$/i.test(sym)) {
      return `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}`;
    }
    return null;
  }

  function renderFollowUpLine(sig) {
    if (!sig.nextDate || sig.nextClose == null || sig.dayReturnPct == null) return "";
    const currency = sig.currency || (isKrTicker(sig.ticker) ? "KRW" : "USD");
    const unit = currency === "USD" ? "" : "원";
    const d1 = formatShortDate(sig.signalDate);
    const d2 = formatShortDate(sig.nextDate);
    const match = sig.directionMatch || "—";
    const ret = Number(sig.dayReturnPct).toFixed(1);
    const matchCls = match === "일치" ? "up" : match === "불일치" ? "down" : "neutral";
    return `<span class="recommend2-card-followup ${matchCls}">${escapeHtml(d1)} 종가:${formatPrice(sig.close, currency)}${unit} ${escapeHtml(d2)} 종가:${formatPrice(sig.nextClose, currency)}${unit} → ${escapeHtml(match)}, 1일 수익률: ${escapeHtml(ret)}%</span>`;
  }

  function buildFilterMeta(recentDays) {
    const window = `최근 ${recentDays}일`;
    return {
      active: {
        label: "지금 진입·매집",
        empty: "현재 장중·종가 기준 진입 신호가 없습니다.",
        emptyRegion: (region) => {
          if (!region) return "진입 신호가 없습니다.";
          const phase = region.marketOpen ? "장중" : "장 마감";
          return `${phase} · ${region.phaseHint || "조건 충족 종목 없음"}`;
        }
      },
      recent: {
        label: "KOSPI",
        window,
        empty: `${window} 내 KOSPI 신호가 없습니다.`
      },
      "kosdaq-2w": {
        label: "KOSDAQ",
        window,
        empty: `${window} 내 KOSDAQ 신호가 없습니다.`
      },
      "nasdaq-2w": {
        label: "NASDAQ",
        window,
        empty: `${window} 내 NASDAQ 신호가 없습니다.`
      },
      "nyse-2w": {
        label: "NYSE",
        window,
        empty: `${window} 내 NYSE 신호가 없습니다.`
      }
    };
  }

  const MARKET_2W_STATS = [
    { key: "kospi", label: "KOSPI" },
    { key: "kosdaq", label: "KOSDAQ" },
    { key: "nasdaq", label: "NASDAQ" },
    { key: "nyse", label: "NYSE" }
  ];

  function getRecentSignalsForMarket(payload, marketKey) {
    const markets = payload?.markets || {};
    if (marketKey === "kospi") {
      return markets.kospi?.recentSignals || payload.recentSignals || [];
    }
    return markets[marketKey]?.recentSignals || [];
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
    return {
      match,
      mismatch,
      pending,
      total: (signals || []).length,
      evaluated,
      ratePct
    };
  }

  function formatMatchRate(ratePct) {
    if (ratePct == null || !Number.isFinite(ratePct)) return "—";
    return `${ratePct.toFixed(1)}%`;
  }

  function renderMatchSummaryPanel(payload) {
    const rows = MARKET_2W_STATS.map(({ key, label }) => {
      const stats = computeMatchStats(getRecentSignalsForMarket(payload, key));
      const rateCls =
        stats.ratePct == null
          ? "neutral"
          : stats.ratePct >= 50
            ? "up"
            : "down";
      const pendingNote =
        stats.pending > 0
          ? `<span class="recommend2-match-pending"> · 판정대기 ${stats.pending}</span>`
          : "";
      return `
        <tr>
          <th scope="row">${escapeHtml(label)}</th>
          <td class="recommend2-match-hit">${stats.match}건</td>
          <td class="recommend2-match-miss">${stats.mismatch}건</td>
          <td class="recommend2-match-rate recommend2-match-rate--${rateCls}">${escapeHtml(formatMatchRate(stats.ratePct))}</td>
          <td class="recommend2-match-total">${stats.total}건${pendingNote}</td>
        </tr>`;
    }).join("");

    return `
      <section class="recommend2-match-summary" aria-label="최근 2주 일치율">
        <p class="recommend2-match-summary-title"><strong>최근 2주</strong> · 익 거래일 상승=일치 · 하락·보합=불일치</p>
        <table class="recommend2-match-table">
          <thead>
            <tr>
              <th scope="col">시장</th>
              <th scope="col">일치</th>
              <th scope="col">불일치</th>
              <th scope="col">일치율</th>
              <th scope="col">신호</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
  }

  function renderMatchSummary(signals, marketBlock) {
    const stats = marketBlock?.matchStats || computeMatchStats(signals);
    if (!stats.evaluated && !signals?.length) return "";
    const rateText = stats.ratePct != null ? ` · 일치율 ${formatMatchRate(stats.ratePct)}` : "";
    const pendingText =
      stats.pending > 0 ? ` · 판정 대기 ${stats.pending}건(익일 미경과)` : "";
    return `<p class="recommend2-match-summary">일치: <strong>${stats.match}</strong>건 · 불일치: <strong>${stats.mismatch}</strong>건${rateText}${pendingText}</p>`;
  }

  function resolveActiveByRegion(payload) {
    const block = payload?.activeByRegion;
    if (block?.kr && block?.us) return block;
    const markets = payload?.markets || {};
    const krSignals = [];
    const usSignals = [];
    const labels = { kospi: "KOSPI", kosdaq: "KOSDAQ", nasdaq: "NASDAQ", nyse: "NYSE" };
    for (const key of ["kospi", "kosdaq"]) {
      for (const sig of markets[key]?.activeSignals || []) {
        krSignals.push({ ...sig, exchange: labels[key], segment: key });
      }
    }
    for (const key of ["nasdaq", "nyse"]) {
      for (const sig of markets[key]?.activeSignals || []) {
        usSignals.push({ ...sig, exchange: labels[key], segment: key });
      }
    }
    return {
      kr: { signals: krSignals, count: krSignals.length, marketOpen: null, phaseHint: "" },
      us: { signals: usSignals, count: usSignals.length, marketOpen: null, phaseHint: "" },
      combined: payload?.activeSignals || [...krSignals, ...usSignals],
      count: (payload?.activeSignals || []).length || krSignals.length + usSignals.length
    };
  }

  function resolveMarketPayload(payload, filter) {
    const markets = payload?.markets || {};
    if (filter === "active") {
      const active = resolveActiveByRegion(payload);
      return { market: active, signals: active.combined || [] };
    }
    if (filter === "recent") {
      const m = markets.kospi || payload;
      return { market: m, signals: m.recentSignals || payload.recentSignals || [] };
    }
    if (filter === "kosdaq-2w") {
      const m = markets.kosdaq || {};
      return { market: m, signals: m.recentSignals || [] };
    }
    if (filter === "nasdaq-2w") {
      const m = markets.nasdaq || {};
      return { market: m, signals: m.recentSignals || [] };
    }
    if (filter === "nyse-2w") {
      const m = markets.nyse || {};
      return { market: m, signals: m.recentSignals || [] };
    }
    return { market: {}, signals: [] };
  }

  function renderStrategyBox(strategy) {
    if (!strategy) return "";
    const rules = (strategy.rules || []).map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    const patterns = (strategy.patterns || [])
      .map(
        (p) =>
          `<div class="recommend2-pattern-card"><strong>${escapeHtml(p.label)}</strong><p>${escapeHtml(p.description)}</p></div>`
      )
      .join("");
    return `
      <details class="recommend2-strategy-details">
        <summary class="recommend2-strategy-summary-toggle">전략 로직 보기 · ${escapeHtml(strategy.title || "")}</summary>
        <section class="recommend2-strategy-box" aria-label="추천 전략">
          <h3 class="recommend2-strategy-title">${escapeHtml(strategy.title || "")}</h3>
          <p class="recommend2-strategy-universe">${escapeHtml(strategy.universe || "")}</p>
          <p class="recommend2-strategy-summary">${escapeHtml(strategy.summary || "")}</p>
          <ol class="recommend2-strategy-rules">${rules}</ol>
          <div class="recommend2-pattern-grid">${patterns}</div>
          <p class="recommend2-disclaimer">${escapeHtml(strategy.disclaimer || "")}</p>
        </section>
      </details>`;
  }

  function renderSignalDetail(sig) {
    if (sig.sma5 != null) {
      return `<span>SMA5 ${formatPrice(sig.sma5, sig.currency)} · SMA20 ${formatPrice(sig.sma20, sig.currency)} · SMA60 ${formatPrice(sig.sma60, sig.currency)}</span>`;
    }
    if (sig.bbMiddle != null) {
      return `<span>BB 상 ${formatPrice(sig.bbUpper, sig.currency)} · 중 ${formatPrice(sig.bbMiddle, sig.currency)} · 하 ${formatPrice(sig.bbLower, sig.currency)}</span>`;
    }
    if (sig.rsi != null) {
      return `<span>RSI(14) ${escapeHtml(String(sig.rsi))}</span>`;
    }
    return "";
  }

  function renderSignalCard(sig) {
    const upCls = sig.up ? "up" : "down";
    const upLabel = sig.up ? "상승" : "하락";
    const currency = sig.currency || (isKrTicker(sig.ticker) ? "KRW" : "USD");
    const followUp = renderFollowUpLine(sig);
    const link = stockLink(sig.ticker);
    const nameHtml = link
      ? `<a href="${link}" target="_blank" rel="noopener noreferrer" class="recommend2-card-name">${escapeHtml(sig.name)}</a>`
      : `<span class="recommend2-card-name">${escapeHtml(sig.name)}</span>`;
    const detail = renderSignalDetail(sig);
    const metricsHtml = followUp
      ? `<span>신호일 <strong>${escapeHtml(sig.signalDate || "—")}</strong></span>${followUp}`
      : `<span>신호일 <strong>${escapeHtml(sig.signalDate || "—")}</strong></span>
          <span>종가 ${formatPrice(sig.close, currency)}</span>
          <span class="${upCls}">당일 ${formatPct(sig.closePct)} (${upLabel})</span>`;
    const exchangeHtml = sig.exchange
      ? `<span class="recommend2-card-exchange">${escapeHtml(sig.exchange)}</span>`
      : "";

    return `
      <article class="recommend2-card recommend2-card--${escapeHtml(sig.pattern || "A")}">
        <div class="recommend2-card-header">
          <span class="recommend2-card-pattern">${escapeHtml(sig.patternLabel || sig.pattern)}</span>
          ${exchangeHtml}
          ${nameHtml}
          <span class="recommend2-card-ticker">${escapeHtml(sig.ticker)}</span>
        </div>
        <div class="recommend2-card-metrics">${metricsHtml}</div>
        ${detail ? `<div class="recommend2-card-detail">${detail}</div>` : ""}
      </article>`;
  }

  function renderRegionBlock(regionKey, region, meta) {
    const title = regionKey === "kr" ? "한국 (KOSPI · KOSDAQ)" : "미국 (NASDAQ · NYSE · 뉴욕 ET)";
    const openBadge =
      region.marketOpen === true
        ? `<span class="recommend2-region-badge recommend2-region-badge--open">장중</span>`
        : region.marketOpen === false
          ? `<span class="recommend2-region-badge">장 마감</span>`
          : "";
    const session = region.sessionLabel ? ` · ${escapeHtml(region.sessionLabel)}` : "";
    const hint = region.phaseHint ? `<p class="recommend2-region-hint">${escapeHtml(region.phaseHint)}</p>` : "";
    const signals = region.signals || [];
    const body = signals.length
      ? `<div class="recommend2-list">${signals.map(renderSignalCard).join("")}</div>`
      : `<p class="recommend2-empty">${escapeHtml(meta.emptyRegion ? meta.emptyRegion(region) : meta.empty)}</p>`;

    return `
      <section class="recommend2-region-block" aria-label="${escapeHtml(title)}">
        <header class="recommend2-region-header">
          <h3 class="recommend2-region-title">${escapeHtml(title)}${session}</h3>
          ${openBadge}
          <span class="recommend2-region-count">${signals.length}건</span>
        </header>
        ${hint}
        ${body}
      </section>`;
  }

  function createStrategyPage(pageConfig) {
    const {
      pageId,
      title,
      intro,
      dataLayer,
      spendKey,
      spendLabel
    } = pageConfig;

    let abortController = null;
    let cachedPayload = null;
    let activeFilter = "active";
    let liveUpdateTimerId = null;
    let liveUpdateStartedAt = 0;
    let accessGranted = false;

    function getFilterMeta() {
      const days = cachedPayload?.recentDays || 14;
      return buildFilterMeta(days);
    }

    function filterSignals(payload, filter) {
      return resolveMarketPayload(payload, filter).signals;
    }

    function renderList(listEl, payload, filter) {
      const FILTER_META = getFilterMeta();
      if (filter === "active") {
        const active = resolveActiveByRegion(payload);
        listEl.innerHTML =
          renderRegionBlock("kr", active.kr || { signals: [] }, FILTER_META.active) +
          renderRegionBlock("us", active.us || { signals: [] }, FILTER_META.active);
        return;
      }
      const items = filterSignals(payload, filter);
      const meta = FILTER_META[filter] || FILTER_META.recent;
      const market = resolveMarketPayload(payload, filter).market;
      const summary = renderMatchSummary(items, market);
      if (!items.length) {
        listEl.innerHTML = `${summary}<p class="recommend2-empty">${escapeHtml(meta.empty)}</p>`;
        return;
      }
      listEl.innerHTML = `${summary}<div class="recommend2-list">${items.map(renderSignalCard).join("")}</div>`;
    }

    function setStatus(el, text, kind) {
      if (!el) return;
      if (!text) {
        el.hidden = true;
        el.textContent = "";
        return;
      }
      el.hidden = false;
      el.textContent = text;
      el.className = `recommend2-status${kind === "error" ? " recommend2-status--error" : ""}`;
    }

    function clearLiveUpdateTimer() {
      if (liveUpdateTimerId != null) {
        clearInterval(liveUpdateTimerId);
        liveUpdateTimerId = null;
      }
    }

    function tickLiveUpdateElapsed(root) {
      const elapsedEl = root.querySelector("#strategy-update-elapsed");
      if (!elapsedEl) return;
      const sec = Math.max(0, Math.floor((Date.now() - liveUpdateStartedAt) / 1000));
      elapsedEl.textContent = `${sec}초`;
    }

    function setLiveUpdating(root, updating) {
      const panel = root.querySelector(".recommend2-panel");
      const overlay = root.querySelector("#strategy-update-overlay");
      const refreshBtn = root.querySelector("#strategy-refresh-btn");
      if (panel) panel.classList.toggle("recommend2-panel--updating", updating);
      if (updating) {
        liveUpdateStartedAt = Date.now();
        tickLiveUpdateElapsed(root);
        clearLiveUpdateTimer();
        liveUpdateTimerId = setInterval(() => tickLiveUpdateElapsed(root), 1000);
        if (overlay) overlay.hidden = false;
        if (refreshBtn) refreshBtn.disabled = true;
      } else {
        clearLiveUpdateTimer();
        if (overlay) overlay.hidden = true;
        if (refreshBtn) refreshBtn.disabled = false;
      }
    }

    function updateView(root, payload) {
      cachedPayload = dataLayer.pickBetterPayload
        ? dataLayer.pickBetterPayload(cachedPayload, payload)
        : payload;
      if (dataLayer.writeCaches) {
        dataLayer.writeCaches(cachedPayload);
      } else if (dataLayer.writeSessionCache) {
        dataLayer.writeSessionCache(cachedPayload);
      }
      const strategyEl = root.querySelector("#strategy-meta-mount");
      if (strategyEl && payload?.strategy) {
        strategyEl.innerHTML = renderStrategyBox(payload.strategy);
      }
      const matchSummaryEl = root.querySelector("#strategy-match-summary-mount");
      if (matchSummaryEl) {
        matchSummaryEl.innerHTML = renderMatchSummaryPanel(payload);
      }
      const updatedEl = root.querySelector("#strategy-updated");
      if (updatedEl) {
        const schedule = payload.updateSchedule || "매일 18:00 KST · 미국 18:00 뉴욕(ET)";
        const analysis = payload.analysisDate || payload.latestSignalDate;
        let line = `${schedule} · 갱신(뉴욕) ${formatUpdatedNy(payload.updatedAtNy || payload.updatedAt)}`;
        if (analysis) line += ` · 분석 T-1=${analysis}`;
        if (payload.lastRecord?.runId) {
          line += ` · 기록 ${payload.lastRecord.signalCount}건 저장됨`;
        } else if (payload.recordError) {
          line += ` · 기록 실패`;
        }
        updatedEl.textContent = line;
      }
      const listEl = root.querySelector("#strategy-list");
      const statusEl = root.querySelector("#strategy-status");
      const items = filterSignals(payload, activeFilter);
      renderList(listEl, payload, activeFilter);
      const FILTER_META = getFilterMeta();
      const meta = FILTER_META[activeFilter] || FILTER_META.active;
      if (activeFilter === "active") {
        const active = resolveActiveByRegion(payload);
        const krN = active.kr?.count ?? 0;
        const usN = active.us?.count ?? 0;
        setStatus(statusEl, `지금 진입·매집 ${items.length}건 · 한국 ${krN} · 미국 ${usN}`, null);
      } else {
        const market = resolveMarketPayload(payload, activeFilter).market;
        const analysis = market.analysisDate || payload.analysisDate || "—";
        setStatus(
          statusEl,
          `${meta.label} ${items.length}건 · ${meta.window || ""} · 분석일 ${analysis}`,
          null
        );
      }
    }

    async function loadData(root, { forceLive = false } = {}) {
      const listEl = root.querySelector("#strategy-list");
      const statusEl = root.querySelector("#strategy-status");
      const prior = cachedPayload || dataLayer.readBestCache?.();
      if (!prior) {
        listEl.innerHTML = `<p class="recommend2-loading">데이터를 불러오는 중…</p>`;
      } else if (!cachedPayload) {
        cachedPayload = prior;
        updateView(root, prior);
      }
      if (abortController) abortController.abort();
      abortController = new AbortController();
      if (forceLive) setLiveUpdating(root, true);
      try {
        const payload = await dataLayer.load({
          forceLive,
          signal: abortController.signal,
          preferCache: !forceLive
        });
        const next = dataLayer.pickBetterPayload
          ? dataLayer.pickBetterPayload(cachedPayload, payload)
          : payload;
        if (forceLive || (dataLayer.payloadScore?.(next) || 0) >= (dataLayer.payloadScore?.(cachedPayload) || 0)) {
          updateView(root, next);
        } else if (cachedPayload) {
          updateView(root, cachedPayload);
        } else {
          updateView(root, next);
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        if (!cachedPayload) {
          listEl.innerHTML = `<p class="recommend2-empty">데이터를 불러오지 못했습니다.</p>`;
          setStatus(statusEl, err.message || String(err), "error");
        } else {
          setStatus(statusEl, `갱신 실패 · 이전 데이터 표시 (${err.message || err})`, "error");
        }
      } finally {
        if (forceLive) setLiveUpdating(root, false);
      }
    }

    function renderGate(container, message, detail) {
      container.innerHTML = `
        <article class="content-panel stock-panel stock-picks-gate recommend2-panel">
          <h2>Stock Picks · ${escapeHtml(title)}</h2>
          <p class="stock-picks-gate-message">${escapeHtml(message)}</p>
          ${detail ? `<p class="stock-picks-gate-detail">${escapeHtml(detail)}</p>` : ""}
          <p class="stock-picks-gate-hint">열람 Digi-Mon 1개 · ↺ 새로고침 1개 · <strong>바닥매집</strong> 탭은 DM 없이 열람 · 갱신 시각 뉴욕(ET) 표시</p>
        </article>`;
      window.StockStrategyNav?.mount?.(container.querySelector(".stock-panel"), pageId);
    }

    async function ensureAccess(isRefresh) {
      const fn = isRefresh
        ? window.Digimon?.spendForStockStrategyRefresh
        : window.Digimon?.spendForStockStrategy;
      if (!fn) {
        return { ok: false, message: "Digi-Mon 모듈을 불러오지 못했습니다.", detail: null };
      }
      const spendResult = await fn(spendKey, spendLabel);
      if (!spendResult.ok) {
        return {
          ok: false,
          message: spendResult.error || "열람할 수 없습니다.",
          detail: `보유 Digi-Mon: ${window.Digimon?.format?.(spendResult.balance) ?? 0}개`
        };
      }
      return { ok: true };
    }

    function mountPage(container) {
      activeFilter = "active";
      cachedPayload = dataLayer.readBestCache?.() || dataLayer.readSessionCache?.() || null;

      container.innerHTML = `
        <article class="content-panel recommend2-panel">
          <header class="recommend2-header">
            <div>
              <h2>Stock Picks · ${escapeHtml(title)}</h2>
              <p class="recommend2-intro">${escapeHtml(intro)}</p>
            </div>
            <button type="button" class="secondary-btn" id="strategy-refresh-btn" title="실시간 스캔 (DM 1)">Re</button>
          </header>
          <div id="strategy-meta-mount"></div>
          <section class="recommend2-filters" aria-label="신호 필터">
            <p class="recommend2-section-label">신호 목록</p>
            <div class="stock-tabs recommend2-tabs" role="tablist">
              <button type="button" class="stock-tab recommend2-tab active" data-filter="active">지금 진입·매집</button>
              <button type="button" class="stock-tab recommend2-tab" data-filter="recent">KOSPI 14일</button>
              <button type="button" class="stock-tab recommend2-tab" data-filter="kosdaq-2w">KOSDAQ 14일</button>
              <button type="button" class="stock-tab recommend2-tab" data-filter="nasdaq-2w">NASDAQ 14일</button>
              <button type="button" class="stock-tab recommend2-tab" data-filter="nyse-2w">NYSE 14일</button>
            </div>
          </section>
          <div id="strategy-match-summary-mount"></div>
          <p id="strategy-updated" class="recommend2-updated"></p>
          <div id="strategy-update-overlay" class="recommend2-update-overlay" hidden role="status" aria-live="polite">
            <span class="recommend2-update-spinner" aria-hidden="true"></span>
            <span class="recommend2-update-label">업데이트중</span>
            <span id="strategy-update-elapsed" class="recommend2-update-elapsed">0초</span>
          </div>
          <p id="strategy-status" class="recommend2-status" hidden></p>
          <div id="strategy-list" class="recommend2-list-wrap"></div>
        </article>`;

      const root = container.querySelector(".recommend2-panel") || container;
      window.StockStrategyNav?.mount?.(root, pageId);

      root.querySelectorAll(".recommend2-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeFilter = btn.dataset.filter || "active";
          root.querySelectorAll(".recommend2-tab").forEach((b) => {
            b.classList.toggle("active", b === btn);
          });
          if (cachedPayload) updateView(root, cachedPayload);
        });
      });

      root.querySelector("#strategy-refresh-btn")?.addEventListener("click", async () => {
        const access = await ensureAccess(true);
        if (!access.ok) {
          setStatus(root.querySelector("#strategy-status"), access.message, "error");
          return;
        }
        void loadData(root, { forceLive: true });
      });

      if (cachedPayload) updateView(root, cachedPayload);
      void loadData(root);
    }

    async function renderPage(container) {
      if (!accessGranted) {
        const session = window.Auth?.getSession?.();
        if (!session) {
          renderGate(container, "로그인이 필요합니다.", "로그인 후 Digi-Mon 1개로 열람할 수 있습니다.");
          return;
        }
        const access = await ensureAccess(false);
        if (!access.ok) {
          renderGate(container, access.message, access.detail);
          return;
        }
        accessGranted = true;
      }
      mountPage(container);
    }

    function leavePage() {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      clearLiveUpdateTimer();
    }

    function destroy() {
      leavePage();
      accessGranted = false;
      /* cachedPayload·localStorage 유지 — 탭 재진입 시 Re 결과 복원 */
    }

    return { renderPage, leavePage, destroy };
  }

  const golden = createStrategyPage({
    pageId: "strategy-golden",
    title: "골든크로스",
    intro: "TOP 50 · 정배열+골든크로스 · 열람 DM 1 · 갱신 뉴욕(ET)",
    dataLayer: window.StockStrategyData?.golden,
    spendKey: "golden-cross",
    spendLabel: "골든크로스"
  });

  const bollinger = createStrategyPage({
    pageId: "strategy-bollinger",
    title: "볼린저밴드",
    intro: "TOP 50 · BB 하단반등·상단돌파 · 열람 DM 1 · 갱신 뉴욕(ET)",
    dataLayer: window.StockStrategyData?.bollinger,
    spendKey: "bollinger",
    spendLabel: "볼린저밴드"
  });

  const rsi = createStrategyPage({
    pageId: "strategy-rsi",
    title: "RSI+다이버전스",
    intro: "TOP 50 · RSI 과매도+상승 다이버전스 · 열람 DM 1 · 갱신 뉴욕(ET)",
    dataLayer: window.StockStrategyData?.rsi,
    spendKey: "rsi-divergence",
    spendLabel: "RSI+다이버전스"
  });

  window.StockStrategyGolden = golden;
  window.StockStrategyBollinger = bollinger;
  window.StockStrategyRsi = rsi;
})();
