/**
 * Stock strategy pages — 골든크로스 / 볼린저 / RSI (DM 1 · 바닥매집 UI 패턴)
 */
(function () {
  const KST_TZ = "Asia/Seoul";

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

  function formatUpdatedKst(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ko-KR", {
      timeZone: KST_TZ,
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

  function renderLiveReturnLine(sig) {
    if (!window.StockLiveAuth?.hasFreshKrLivePrice?.(sig)) return "";
    const price = Number(sig.livePrice);
    const returnPct = Number(sig.liveReturnPct);
    if (!Number.isFinite(price) || !Number.isFinite(returnPct)) return "";
    const currency = sig.currency || "KRW";
    const cls = returnPct > 0 ? "up" : returnPct < 0 ? "down" : "neutral";
    const at = new Date(sig.livePriceAt).toLocaleTimeString("ko-KR", {
      timeZone: KST_TZ,
      hour: "2-digit",
      minute: "2-digit"
    });
    return `<span class="recommend2-card-followup ${cls}">현재가 ${formatPrice(price, currency)} · 장중 수익률 ${formatPct(returnPct)} · ${escapeHtml(at)} 기준</span>`;
  }

  function renderFollowUpLine(sig) {
    const liveLine = renderLiveReturnLine(sig);
    if (!sig.nextDate || sig.nextClose == null || sig.dayReturnPct == null) return liveLine;
    const currency = sig.currency || (isKrTicker(sig.ticker) ? "KRW" : "USD");
    const unit = currency === "USD" ? "" : "원";
    const d1 = formatShortDate(sig.signalDate);
    const d2 = formatShortDate(sig.nextDate);
    const match = sig.directionMatch || "—";
    const ret = Number(sig.dayReturnPct).toFixed(1);
    const matchCls = match === "일치" ? "up" : match === "불일치" ? "down" : "neutral";
    const followUp = `<span class="recommend2-card-followup ${matchCls}">${escapeHtml(d1)} 종가:${formatPrice(sig.close, currency)}${unit} ${escapeHtml(d2)} 종가:${formatPrice(sig.nextClose, currency)}${unit} → ${escapeHtml(match)}, 1일 수익률: ${escapeHtml(ret)}%</span>`;
    return followUp + liveLine;
  }

  function buildFilterMeta(recentDays) {
    const window = `최근 ${recentDays}일`;
    return {
      active: {
        label: "지금 진입·매집",
        empty: "T-1 종가 기준 진입 신호가 없습니다. (당일·전일 장마감 조건만 표시)",
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

  const MatchStats = window.StockMatchStats || {};
  const computeMatchStats = MatchStats.computeMatchStats || (() => ({}));
  const mergeMatchStats = MatchStats.mergeStats || ((signals) => computeMatchStats(signals));
  const formatMatchRate = MatchStats.formatMatchRate || (() => "—");
  const formatReturnSum = MatchStats.formatReturnSum || (() => "—");
  const matchRateClass = MatchStats.rateClass || (() => "neutral");
  const returnSumClass = MatchStats.returnSumClass || (() => "neutral");

  function filterByPattern(signals, patternId) {
    if (!patternId || patternId === "all") return signals || [];
    return (signals || []).filter((s) => s.pattern === patternId);
  }

  function renderMatchSummaryPanel(payload, patternId = "all") {
    const rows = MARKET_2W_STATS.map(({ key, label }) => {
      const stats = mergeMatchStats(
        filterByPattern(getRecentSignalsForMarket(payload, key), patternId)
      );
      const rateCls = matchRateClass(stats.ratePct);
      const retCls = returnSumClass(stats.returnSumPct);
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
          <td class="recommend2-match-rate recommend2-match-rate--${retCls}">${escapeHtml(formatReturnSum(stats.returnSumPct))}</td>
          <td class="recommend2-match-total">${stats.total}건${pendingNote}</td>
        </tr>`;
    }).join("");

    return `
      <section class="recommend2-match-summary" aria-label="최근 2주 일치율">
        <p class="recommend2-match-summary-title"><strong>최근 2주</strong> · 익 거래일 상승=일치 · 하락·보합=불일치 · 수익률: 신호일 종가 매입 · 1일차(익일) 합산</p>
        <table class="recommend2-match-table">
          <thead>
            <tr>
              <th scope="col">시장</th>
              <th scope="col">일치</th>
              <th scope="col">불일치</th>
              <th scope="col">일치율</th>
              <th scope="col">수익률</th>
              <th scope="col">신호</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
  }

  function renderMatchSummary(signals, marketBlock) {
    const stats = marketBlock?.matchStats || mergeMatchStats(signals);
    if (!stats.evaluated && !signals?.length) return "";
    const rateText = stats.ratePct != null ? ` · 일치율 ${formatMatchRate(stats.ratePct)}` : "";
    const returnText =
      stats.returnSumPct != null ? ` · 수익률 ${formatReturnSum(stats.returnSumPct)}` : "";
    const pendingText =
      stats.pending > 0 ? ` · 판정 대기 ${stats.pending}건(익일 미경과)` : "";
    return `<p class="recommend2-match-summary">일치: <strong>${stats.match}</strong>건 · 불일치: <strong>${stats.mismatch}</strong>건${rateText}${returnText}${pendingText}</p>`;
  }

  function signalDayT1(sig) {
    return String(sig?.day1 || sig?.signalDate || "").slice(0, 10);
  }

  function filterActiveSignalsT1(signals, markets) {
    return (signals || []).filter((sig) => {
      const seg = sig.segment;
      const analysis =
        (seg && markets?.[seg]?.analysisDate) ||
        markets?.kospi?.analysisDate ||
        markets?.nasdaq?.analysisDate;
      if (!analysis) return false;
      return signalDayT1(sig) === String(analysis).slice(0, 10);
    });
  }

  function refineActiveByRegion(active, markets) {
    if (!active) return active;
    const krSignals = filterActiveSignalsT1(active.kr?.signals, markets);
    const usSignals = filterActiveSignalsT1(active.us?.signals, markets);
    return {
      ...active,
      kr: { ...(active.kr || {}), signals: krSignals, count: krSignals.length },
      us: { ...(active.us || {}), signals: usSignals, count: usSignals.length },
      combined: [...krSignals, ...usSignals],
      count: krSignals.length + usSignals.length
    };
  }

  function sortSignalsNewestFirst(signals) {
    return [...(signals || [])].sort((a, b) => {
      const da = String(a.signalDate || a.day1 || "");
      const db = String(b.signalDate || b.day1 || "");
      if (da !== db) return db.localeCompare(da);
      return String(a.ticker || "").localeCompare(String(b.ticker || ""));
    });
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
      const active = refineActiveByRegion(resolveActiveByRegion(payload), markets);
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
    if (sig.pivotHigh != null) {
      const parts = [];
      if (sig.pullbackPct != null) parts.push(`조정 ${escapeHtml(String(sig.pullbackPct))}%`);
      parts.push(`피벗 ${formatPrice(sig.pivotHigh, sig.currency)}`);
      if (sig.range10Pct != null) parts.push(`10일범위 ${escapeHtml(String(sig.range10Pct))}%`);
      if (sig.sma50 != null) parts.push(`SMA50 ${formatPrice(sig.sma50, sig.currency)}`);
      return `<span>${parts.join(" · ")}</span>`;
    }
    if (sig.neckline != null) {
      return `<span>넥라인 ${formatPrice(sig.neckline, sig.currency)}</span>`;
    }
    if (sig.obv != null) {
      return `<span>OBV ${escapeHtml(String(sig.obv))}</span>`;
    }
    if (sig.supportType != null) {
      const parts = [`지지 ${escapeHtml(sig.supportType)}`];
      if (sig.sma20 != null) parts.push(`SMA20 ${formatPrice(sig.sma20, sig.currency)}`);
      if (sig.sma60 != null) parts.push(`SMA60 ${formatPrice(sig.sma60, sig.currency)}`);
      return `<span>${parts.join(" · ")}</span>`;
    }
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
      spendLabel,
      renderUsageGuide = null
    } = pageConfig;

    const hasUsageGuide = typeof renderUsageGuide === "function";

    let abortController = null;
    let cachedPayload = null;
    let activeFilter = "active";
    let activePattern = "all";
    let liveUpdateTimerId = null;
    let liveUpdateStartedAt = 0;
    let accessGranted = false;
    let activeRoot = null;
    let scanStatusUnbind = null;
    let loadGeneration = 0;

    function applyPartial(partial) {
      const next = dataLayer.pickBetterPayload
        ? dataLayer.pickBetterPayload(cachedPayload, partial)
        : partial;
      cachedPayload = next;
      if (dataLayer.writeCaches) {
        dataLayer.writeCaches(next);
      } else if (dataLayer.writeSessionCache) {
        dataLayer.writeSessionCache(next);
      }
      if (activeRoot?.isConnected) updateView(activeRoot, next);
    }

    function getFilterMeta() {
      const days = cachedPayload?.recentDays || 14;
      return buildFilterMeta(days);
    }

    function filterSignals(payload, filter) {
      const items = sortSignalsNewestFirst(resolveMarketPayload(payload, filter).signals);
      return filterByPattern(items, activePattern);
    }

    function filterActiveRegion(active, markets) {
      if (!active) return active;
      const refined = refineActiveByRegion(active, markets);
      const krSignals = filterByPattern(refined.kr?.signals, activePattern);
      const usSignals = filterByPattern(refined.us?.signals, activePattern);
      return {
        ...active,
        kr: { ...(active.kr || {}), signals: krSignals, count: krSignals.length },
        us: { ...(active.us || {}), signals: usSignals, count: usSignals.length },
        combined: [...krSignals, ...usSignals],
        count: krSignals.length + usSignals.length
      };
    }

    function syncPatternTabs(root, payload) {
      const mount = root.querySelector("#strategy-pattern-tabs-mount");
      if (!mount) return;
      const patterns = payload?.strategy?.patterns || [];
      if (patterns.length < 2) {
        mount.hidden = true;
        mount.innerHTML = "";
        activePattern = "all";
        return;
      }
      mount.hidden = false;
      const tabs = [
        { id: "all", label: "전체" },
        ...patterns.map((p) => ({ id: p.id, label: p.label || p.id }))
      ];
      mount.innerHTML = `
        <p class="recommend2-section-label">패턴</p>
        <div class="stock-tabs recommend2-tabs recommend2-pattern-tabs" role="tablist">
          ${tabs
            .map(
              (t) =>
                `<button type="button" class="stock-tab recommend2-tab recommend2-pattern-tab${
                  activePattern === t.id ? " active" : ""
                }" data-pattern="${escapeHtml(t.id)}">${escapeHtml(t.label)}</button>`
            )
            .join("")}
        </div>`;
    }

    function renderList(listEl, payload, filter) {
      const FILTER_META = getFilterMeta();
      if (filter === "active") {
        const active = filterActiveRegion(resolveActiveByRegion(payload), payload?.markets || {});
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

    function setOverlayStep(root, text) {
      const stepEl = root.querySelector("#strategy-update-step");
      if (stepEl && text) stepEl.textContent = text;
    }

    function shouldShowUpdatingOverlay() {
      return !!window.StockScanLock?.isAnyScanBusy?.();
    }

    function setLiveUpdating(root, updating, opts = {}) {
      const panel = root.classList?.contains("recommend2-panel")
        ? root
        : root.querySelector(".recommend2-panel");
      const overlay = root.querySelector("#strategy-update-overlay");
      const refreshBtn = root.querySelector("#strategy-refresh-btn");
      const alreadyUpdating =
        !!panel?.classList.contains("recommend2-panel--updating") && liveUpdateTimerId != null;

      if (updating) {
        if (panel) panel.classList.add("recommend2-panel--updating");
        const serverMs = opts.startedAtMs;
        if (serverMs != null && Number.isFinite(serverMs)) {
          if (!alreadyUpdating || serverMs < liveUpdateStartedAt) {
            liveUpdateStartedAt = serverMs;
          }
        } else if (!alreadyUpdating) {
          liveUpdateStartedAt = Date.now();
        }
        if (alreadyUpdating) {
          tickLiveUpdateElapsed(root);
          if (overlay) overlay.hidden = false;
          if (refreshBtn) refreshBtn.disabled = true;
          if (opts.stepLabel) setOverlayStep(root, opts.stepLabel);
          return;
        }
        tickLiveUpdateElapsed(root);
        clearLiveUpdateTimer();
        liveUpdateTimerId = setInterval(() => tickLiveUpdateElapsed(root), 1000);
        if (overlay) overlay.hidden = false;
        if (refreshBtn) refreshBtn.disabled = true;
        if (opts.stepLabel) setOverlayStep(root, opts.stepLabel);
      } else if (shouldShowUpdatingOverlay()) {
        if (panel) panel.classList.add("recommend2-panel--updating");
        const state = window.StockScanLock?.getGlobalScanState?.();
        const serverMs = state?.startedAtMs;
        if (serverMs != null && Number.isFinite(serverMs)) {
          liveUpdateStartedAt = serverMs;
        } else if (!liveUpdateTimerId) {
          liveUpdateStartedAt = Date.now();
        }
        tickLiveUpdateElapsed(root);
        if (!liveUpdateTimerId) {
          clearLiveUpdateTimer();
          liveUpdateTimerId = setInterval(() => tickLiveUpdateElapsed(root), 1000);
        }
        if (state?.message) setOverlayStep(root, state.message);
        if (overlay) overlay.hidden = false;
        if (refreshBtn) refreshBtn.disabled = true;
      } else {
        if (panel) panel.classList.remove("recommend2-panel--updating");
        clearLiveUpdateTimer();
        if (overlay) overlay.hidden = true;
        if (refreshBtn) refreshBtn.disabled = false;
        setOverlayStep(root, "업데이트중");
      }
    }

    function paintUpdatedLine(root, payload) {
      const updatedEl = root.querySelector("#strategy-updated");
      if (!updatedEl) return;
      const src = payload || cachedPayload;
      const schedule = src?.updateSchedule || "매일 18:00 (한국) · 매일 18:00 (뉴욕)";
      const analysis = src?.analysisDate || src?.latestSignalDate;
      const iso =
        src?.updatedAtKst ||
        src?.updatedAt ||
        window.StockScanLock?.resolveUpdatedIso?.(pageId, src);
      const ts = formatUpdatedKst(iso);
      let line = `마지막 갱신 <span class="stock-page-updated-at">${escapeHtml(ts)}</span> · ${escapeHtml(schedule)}`;
      if (analysis) line += ` · 분석 T-1=${escapeHtml(analysis)}`;
      if (src?.lastRecord?.runId) {
        line += ` · 기록 ${src.lastRecord.signalCount}건 저장됨`;
      } else if (src?.recordError) {
        line += ` · 기록 실패`;
      }
      updatedEl.innerHTML = line;
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
      if (strategyEl && cachedPayload?.strategy) {
        strategyEl.innerHTML = renderStrategyBox(cachedPayload.strategy);
      }
      const matchSummaryEl = root.querySelector("#strategy-match-summary-mount");
      if (matchSummaryEl) {
        matchSummaryEl.innerHTML = renderMatchSummaryPanel(cachedPayload, activePattern);
      }
      syncPatternTabs(root, cachedPayload);
      paintUpdatedLine(root, cachedPayload);
      const listEl = root.querySelector("#strategy-list");
      const statusEl = root.querySelector("#strategy-status");
      const analysis = cachedPayload?.analysisDate || cachedPayload?.latestSignalDate;
      const items = filterSignals(cachedPayload, activeFilter);
      renderList(listEl, cachedPayload, activeFilter);
      const FILTER_META = getFilterMeta();
      const meta = FILTER_META[activeFilter] || FILTER_META.active;
      if (activeFilter === "active") {
        const active = filterActiveRegion(resolveActiveByRegion(cachedPayload), cachedPayload?.markets || {});
        const krN = active.kr?.count ?? 0;
        const usN = active.us?.count ?? 0;
        setStatus(statusEl, `지금 진입·매집 ${items.length}건 · 한국 ${krN} · 미국 ${usN}`, null);
      } else {
        setStatus(
          statusEl,
          `${meta.label} ${items.length}건 · ${meta.window || ""} · 분석일 ${analysis}`,
          null
        );
      }
      if (cachedPayload && !dataLayer.isPlaceholderPayload?.(cachedPayload)) {
        window.StockScanLock?.recordPagePayload?.(pageId, cachedPayload);
      }
    }

    function showPriorCache(root) {
      const prior = cachedPayload || dataLayer.readBestCache?.();
      if (!prior) return false;
      cachedPayload = prior;
      updateView(root, prior);
      return true;
    }

    async function loadData(root, { forceLive = false } = {}) {
      const listEl = root.querySelector("#strategy-list");
      const statusEl = root.querySelector("#strategy-status");
      if (forceLive) loadGeneration += 1;
      const myGen = loadGeneration;

      if (!forceLive && window.StockScanLock?.shouldKeepLiveScan?.(pageId)) {
        activeRoot = root;
        showPriorCache(root);
        setLiveUpdating(root, true);
        const scanState = window.StockScanLock?.getGlobalScanState?.();
        if (scanState?.message) {
          setOverlayStep(root, scanState.message);
        }
        return;
      }

      const prior = cachedPayload || dataLayer.readBestCache?.();
      const hasCache = !!prior;
      if (!prior) {
        listEl.innerHTML = `<p class="recommend2-loading">데이터를 불러오는 중…</p>`;
      } else if (!cachedPayload) {
        cachedPayload = prior;
        updateView(root, prior);
      }
      if (abortController && !window.StockScanLock?.shouldKeepLiveScan?.(pageId)) {
        abortController.abort();
      }
      if (!window.StockScanLock?.shouldKeepLiveScan?.(pageId)) {
        abortController = new AbortController();
      } else if (!abortController) {
        abortController = new AbortController();
      }
      if (forceLive) {
        setLiveUpdating(root, true);
        setStatus(
          statusEl,
          `실시간 스캔 중… KOSPI·KOSDAQ·NASDAQ·NYSE · ${title}`,
          "info"
        );
      }
      try {
        const payload = await dataLayer.load({
          forceLive,
          signal: abortController.signal,
          preferCache: !forceLive,
          staleWhileRevalidate: !forceLive && hasCache,
          onFresh: (fresh) => {
            if (myGen !== loadGeneration || !root.isConnected) return;
            const next = dataLayer.pickBetterPayload
              ? dataLayer.pickBetterPayload(cachedPayload, fresh)
              : fresh;
            if ((dataLayer.payloadScore?.(next) || 0) >= (dataLayer.payloadScore?.(cachedPayload) || 0)) {
              updateView(root, next);
            }
          },
          onProgress: forceLive
            ? (progress) => {
                if (myGen !== loadGeneration) return;
                setStatus(
                  statusEl,
                  `${title} 스캔 (${progress.step}/${progress.total}) · ${progress.label} TOP 100…`,
                  "info"
                );
              }
            : undefined,
          onPartial: forceLive
            ? (partial) => {
                applyPartial(partial);
                if (root.isConnected) {
                  const next = dataLayer.pickBetterPayload
                    ? dataLayer.pickBetterPayload(cachedPayload, partial)
                    : partial;
                  updateView(root, next);
                }
              }
            : undefined
        });
        if (myGen !== loadGeneration) return;
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
        if (myGen !== loadGeneration) return;
        if (err.code === "scan_busy_blocked") {
          window.StockScanLock?.reportReFailure?.(err, pageId);
          setStatus(statusEl, err.message || "이미 스캔 중입니다.", "info");
          return;
        }
        if (forceLive) {
          window.StockScanLock?.reportReFailure?.(err, pageId);
        }
        if (forceLive && err.code === "network_error") {
          setStatus(statusEl, err.message, "error");
          return;
        }
        if (!cachedPayload) {
          listEl.innerHTML = `<p class="recommend2-empty">데이터를 불러오지 못했습니다.</p>`;
          setStatus(statusEl, err.message || String(err), "error");
        } else {
          setStatus(statusEl, `갱신 실패 · 이전 데이터 표시 (${err.message || err})`, "error");
        }
      } finally {
        if (forceLive && myGen === loadGeneration) {
          await window.Digimon?.refresh?.();
          await window.StockScanLock?.finishForceLiveUi?.(root, setLiveUpdating);
        }
      }
    }

    async function refreshIntradayPrices(root) {
      const statusEl = root.querySelector("#strategy-status");
      const hintEl = root.querySelector(".recommend2-update-hint");
      const priorHint = hintEl?.textContent || "";
      const prior = cachedPayload || dataLayer.readBestCache?.();
      if (!prior) {
        throw new Error("현재가를 적용할 추천 목록이 없습니다.");
      }

      const notice = "장중이라 추천종목들의 현재가만 업데이트합니다.";
      if (hintEl) hintEl.textContent = "전체 종목 재분석 없이 추천종목 현재가만 조회합니다.";
      setStatus(statusEl, notice, "info");
      setLiveUpdating(root, true, { stepLabel: notice });
      try {
        const result = await window.StockLiveAuth.refreshKrLivePrices(prior);
        cachedPayload = result.payload;
        if (dataLayer.writeCaches) dataLayer.writeCaches(cachedPayload);
        else if (dataLayer.writeSessionCache) dataLayer.writeSessionCache(cachedPayload);
        updateView(root, cachedPayload);
        setStatus(
          statusEl,
          `${notice} · ${result.updatedCount}/${result.requestedCount}종목 완료`,
          "info"
        );
      } finally {
        setLiveUpdating(root, false);
        if (hintEl) hintEl.textContent = priorHint;
      }
    }

    function renderGate(container, message, detail) {
      container.innerHTML = `
        <article class="content-panel stock-panel stock-picks-gate recommend2-panel">
          <h2>Stock Picks · ${escapeHtml(title)}</h2>
          <p class="stock-picks-gate-message">${escapeHtml(message)}</p>
          ${detail ? `<p class="stock-picks-gate-detail">${escapeHtml(detail)}</p>` : ""}
          <p class="stock-picks-gate-hint">열람 Digi-Mon 1개 · TOP 100 · 매일 자동 스냅샷</p>
        </article>`;
      window.StockStrategyNav?.mount?.(container.querySelector(".stock-panel"), pageId);
    }

    async function ensureAccess() {
      const fn = window.Digimon?.spendForStockStrategy;
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
      activePattern = "all";
      cachedPayload = dataLayer.readBestCache?.() || dataLayer.readSessionCache?.() || null;

      const guideHtml = hasUsageGuide ? renderUsageGuide() || "" : "";
      const canRe = window.StockLiveAuth?.canShortTermLiveRe?.(window.Auth?.getSession?.());
      const reBtnHtml = canRe
        ? `<button type="button" class="secondary-btn" id="strategy-refresh-btn" title="운영자 실시간 스캔 (4시장 · 장중 점검용)">Re</button>`
        : "";
      const intradayNotice =
        canRe && window.StockLiveAuth?.isKrMarketOpen?.()
          ? `<p class="stock-page-updated stock-intraday-refresh-notice">장중이라 추천종목들의 현재가만 업데이트합니다.</p>`
          : "";

      container.innerHTML = `
        <article class="content-panel recommend2-panel${hasUsageGuide ? " recommend2-panel--has-guide" : ""}">
          <div id="strategy-main-view">
          <header class="recommend2-header">
            <div>
              <div class="recommend2-header-title-row">
                <h2>Stock Picks · ${escapeHtml(title)}</h2>
                ${
                  hasUsageGuide
                    ? `<button type="button" class="secondary-btn strategy-guide-open-btn">활용 가이드</button>`
                    : ""
                }
              </div>
              <p class="recommend2-intro">${escapeHtml(intro)}</p>
            </div>
            ${reBtnHtml}
          </header>
          ${intradayNotice}
          <p id="strategy-updated" class="stock-page-updated">마지막 갱신 <span class="stock-page-updated-at">—</span></p>
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
            <div id="strategy-pattern-tabs-mount" class="recommend2-pattern-tabs-mount" hidden></div>
          </section>
          <div id="strategy-match-summary-mount"></div>
          <div id="strategy-update-overlay" class="recommend2-update-overlay" hidden role="status" aria-live="polite">
            <span class="recommend2-update-spinner" aria-hidden="true"></span>
            <span class="recommend2-update-label" id="strategy-update-step">업데이트중</span>
            <span id="strategy-update-elapsed" class="recommend2-update-elapsed">0초</span>
            <span class="recommend2-update-hint">시장당 2~5분 · 4시장 순차 스캔(총 10~20분 가능). 6분 넘게 (1/4)에서 멈추면 새로고침 후 다시 시도하세요.</span>
          </div>
          <p id="strategy-status" class="recommend2-status" hidden></p>
          <div id="strategy-list" class="recommend2-list-wrap"></div>
          </div>
          ${
            hasUsageGuide && guideHtml
              ? `<div id="strategy-guide-view" class="strategy-guide-view" hidden>
            ${guideHtml}
            <div class="strategy-guide-footer">
              <button type="button" class="secondary-btn strategy-guide-back-btn">← 신호 목록으로</button>
            </div>
          </div>`
              : ""
          }
        </article>`;

      const root = container.querySelector(".recommend2-panel") || container;
      activeRoot = root;
      cachedPayload = cachedPayload || dataLayer.readBestCache?.() || null;
      showPriorCache(root);

      scanStatusUnbind?.();
      scanStatusUnbind =
        window.StockScanLock?.bindScanStatus?.(pageId, (msg, kind, busy, startedAtMs, scanState) => {
          const el = root.querySelector("#strategy-status");
          if (!busy) {
            setLiveUpdating(root, false);
            return;
          }
          showPriorCache(root);
          setStatus(el, msg, kind || "info");
          setLiveUpdating(root, true, {
            startedAtMs,
            stepLabel: scanState?.message || msg
          });
        }) || null;
      window.StockScanLock?.syncPageScanOverlay?.(root, setLiveUpdating);
      window.StockStrategyNav?.mount?.(root, pageId);

      root.querySelectorAll(".recommend2-tab:not(.recommend2-pattern-tab)").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeFilter = btn.dataset.filter || "active";
          root.querySelectorAll(".recommend2-tab:not(.recommend2-pattern-tab)").forEach((b) => {
            b.classList.toggle("active", b === btn);
          });
          if (cachedPayload) updateView(root, cachedPayload);
        });
      });

      root.querySelector("#strategy-pattern-tabs-mount")?.addEventListener("click", (e) => {
        const btn = e.target.closest?.(".recommend2-pattern-tab");
        if (!btn) return;
        activePattern = btn.dataset.pattern || "all";
        root.querySelectorAll(".recommend2-pattern-tab").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        if (cachedPayload) updateView(root, cachedPayload);
      });

      root.querySelector("#strategy-refresh-btn")?.addEventListener("click", async () => {
        const session = window.Auth?.getSession?.();
        if (!session) {
          setStatus(root.querySelector("#strategy-status"), "로그인이 필요합니다.", "error");
          return;
        }
        if (!window.StockLiveAuth?.canShortTermLiveRe?.(session)) {
          setStatus(root.querySelector("#strategy-status"), "권한없음", "error");
          return;
        }
        if (window.StockLiveAuth?.isKrMarketOpen?.()) {
          try {
            await refreshIntradayPrices(root);
          } catch (err) {
            if (err?.name !== "AbortError") {
              setStatus(root.querySelector("#strategy-status"), err?.message || String(err), "error");
            }
          }
          return;
        }
        if (window.StockScanLock && !(await window.StockScanLock.guardReClick(pageId))) {
          return;
        }
        void loadData(root, { forceLive: true });
      });

      if (hasUsageGuide) {
        const mainView = root.querySelector("#strategy-main-view");
        const guideView = root.querySelector("#strategy-guide-view");
        const openBtn = root.querySelector(".strategy-guide-open-btn");
        const backBtn = root.querySelector(".strategy-guide-back-btn");

        function setGuideOpen(open) {
          if (mainView) mainView.hidden = open;
          if (guideView) guideView.hidden = !open;
          if (open) {
            guideView?.scrollIntoView?.({ block: "start", behavior: "smooth" });
          }
        }

        openBtn?.addEventListener("click", () => setGuideOpen(true));
        backBtn?.addEventListener("click", () => setGuideOpen(false));
      }

      if (!cachedPayload) paintUpdatedLine(root, null);
      void window.StockPicksPrefetch?.prefetchPage?.(pageId)?.then?.(() => {
        if (root.isConnected && !cachedPayload) showPriorCache(root);
      });
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
      scanStatusUnbind?.();
      scanStatusUnbind = null;
      activeRoot = null;
      if (abortController && !window.StockScanLock?.shouldKeepLiveScan?.(pageId)) {
        abortController.abort();
        abortController = null;
      }
      if (!window.StockScanLock?.shouldKeepLiveScan?.(pageId)) {
        clearLiveUpdateTimer();
      }
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
    intro: "TOP 100 · 정배열+골든크로스 · 매일 자동 스냅샷 · 열람 DM 1",
    dataLayer: window.StockStrategyData?.golden,
    spendKey: "golden-cross",
    spendLabel: "골든크로스",
    renderUsageGuide: () => window.StockStrategyGoldenGuide?.renderHtml?.()
  });

  const bollinger = createStrategyPage({
    pageId: "strategy-bollinger",
    title: "볼린저밴드",
    intro: "TOP 100 · BB 하단반등·상단돌파 · 매일 자동 스냅샷 · 열람 DM 1",
    dataLayer: window.StockStrategyData?.bollinger,
    spendKey: "bollinger",
    spendLabel: "볼린저밴드",
    renderUsageGuide: () => window.StockStrategyBollingerGuide?.renderHtml?.()
  });

  const rsi = createStrategyPage({
    pageId: "strategy-rsi",
    title: "RSI+다이버전스",
    intro: "TOP 100 · RSI 과매도+상승 다이버전스 · 매일 자동 스냅샷 · 열람 DM 1",
    dataLayer: window.StockStrategyData?.rsi,
    spendKey: "rsi-divergence",
    spendLabel: "RSI+다이버전스",
    renderUsageGuide: () => window.StockStrategyRsiGuide?.renderHtml?.()
  });

  window.StockStrategyGolden = golden;
  window.StockStrategyBollinger = bollinger;
  window.StockStrategyRsi = rsi;

  const candleSupport = createStrategyPage({
    pageId: "strategy-candle-support",
    title: "지지+반전캔들",
    intro: "TOP 100 · 지지선+망치·샛별·장악 · 매일 자동 스냅샷 · 열람 DM 1",
    dataLayer: window.StockStrategyData?.candleSupport,
    spendKey: "candle-support",
    spendLabel: "지지+반전캔들",
    renderUsageGuide: () => window.StockStrategyCandleSupportGuide?.renderHtml?.()
  });

  window.StockStrategyCandleSupport = candleSupport;

  const obv = createStrategyPage({
    pageId: "strategy-obv",
    title: "OBV+다이버전스",
    intro: "TOP 100 · 가격 LL·OBV HL 매집 다이버전스 · 매일 자동 스냅샷 · 열람 DM 1",
    dataLayer: window.StockStrategyData?.obv,
    spendKey: "obv-divergence",
    spendLabel: "OBV+다이버전스",
    renderUsageGuide: () => window.StockStrategyObvGuide?.renderHtml?.()
  });

  const bottomPattern = createStrategyPage({
    pageId: "strategy-bottom",
    title: "쌍·삼중바닥",
    intro: "TOP 100 · 쌍바닥·삼중바닥 넥라인 돌파 · 매일 자동 스냅샷 · 열람 DM 1",
    dataLayer: window.StockStrategyData?.bottom,
    spendKey: "bottom-pattern",
    spendLabel: "쌍·삼중바닥",
    renderUsageGuide: () => window.StockStrategyBottomPatternGuide?.renderHtml?.()
  });

  window.StockStrategyObv = obv;
  window.StockStrategyBottom = bottomPattern;

  const vcpPage = createStrategyPage({
    pageId: "strategy-vcp",
    title: "VCP",
    intro: "TOP 100 · 변동성 수축·피벗 돌파 · 매일 자동 스냅샷 · 열람 DM 1",
    dataLayer: window.StockStrategyData?.vcp,
    spendKey: "vcp",
    spendLabel: "VCP",
    renderUsageGuide: () => window.StockStrategyVcpGuide?.renderHtml?.()
  });

  window.StockStrategyVcp = vcpPage;
})();
