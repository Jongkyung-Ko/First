/**
 * 추천2 페이지 — 바닥매집 전략 (Stock Picks와 별도 모듈)
 */
(function () {
  const Data = window.Recommend2Data;
  if (!Data) {
    console.warn("Recommend2: Recommend2Data not loaded");
    return;
  }

  let abortController = null;
  let cachedPayload = null;
  let activeFilter = "active";
  let liveUpdateTimerId = null;
  let liveUpdateStartedAt = 0;

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

  function formatUpdated(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
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

  function formatShortDate(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso || "—";
    return `${Number(m[2])}/${Number(m[3])}`;
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
    return `<span class="recommend2-card-followup ${matchCls}">${escapeHtml(d1)} 종가:${formatPrice(sig.close, currency)}${unit} ${escapeHtml(d2)} 종가:${formatPrice(sig.nextClose, currency)}${unit} → ${escapeHtml(match)}, 1일 수익율: ${escapeHtml(ret)}%</span>`;
  }

  function isKrTicker(ticker) {
    return /\.(KS|KQ)$/i.test(String(ticker || ""));
  }

  const FILTER_META = {
    active: {
      label: "KOSPI TOP 100",
      empty: "최근 거래일 기준 매집 신호 종목이 없습니다.",
      emptyActive: (p) =>
        p?.activeIsFallback === false && p?.analysisDate
          ? `분석 기준일 ${p.analysisDate}에 조건을 충족한 매집 신호가 없습니다.`
          : "최근 거래일 기준 매집 신호 종목이 없습니다."
    },
    recent: {
      label: "KOSPI TOP 100",
      window: "최근 2주",
      empty: "최근 2주 내 KOSPI 매집 신호가 없습니다."
    },
    "kosdaq-2w": {
      label: "KOSDAQ TOP 100",
      window: "최근 2주",
      empty: "최근 2주 내 KOSDAQ 매집 신호가 없습니다."
    },
    "nasdaq-2w": {
      label: "NASDAQ TOP 100",
      window: "최근 2주",
      empty: "최근 2주 내 NASDAQ 매집 신호가 없습니다."
    },
    "nyse-2w": {
      label: "NYSE TOP 100",
      window: "최근 2주",
      empty: "최근 2주 내 NYSE 매집 신호가 없습니다."
    }
  };

  function resolveMarketPayload(payload, filter) {
    const markets = payload?.markets || {};
    if (filter === "active" || filter === "recent") {
      const kospi = markets.kospi || payload;
      return {
        market: kospi,
        signals:
          filter === "active"
            ? kospi.activeSignals || payload.activeSignals || []
            : kospi.recentSignals || payload.recentSignals || []
      };
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

  function filterSignals(payload, filter) {
    return resolveMarketPayload(payload, filter).signals;
  }

  function renderStrategyBox(strategy) {
    if (!strategy) return "";
    const rules = (strategy.rules || [])
      .map((r) => `<li>${escapeHtml(r)}</li>`)
      .join("");
    const patterns = (strategy.patterns || [])
      .map(
        (p) =>
          `<div class="recommend2-pattern-card"><strong>${escapeHtml(p.label)}</strong><p>${escapeHtml(p.description)}</p></div>`
      )
      .join("");
    const bt = strategy.backtest || {};
    const rowA = bt.A || {};
    const rowB = bt.B || {};

    return `
      <details class="recommend2-strategy-details">
        <summary class="recommend2-strategy-summary-toggle">전략 로직 보기 · ${escapeHtml(strategy.title || "바닥매집")}</summary>
        <section class="recommend2-strategy-box" aria-label="추천 전략">
        <h3 class="recommend2-strategy-title">추천 전략 · ${escapeHtml(strategy.title || "바닥매집")}</h3>
        <p class="recommend2-strategy-universe">${escapeHtml(strategy.universe || "")}</p>
        <p class="recommend2-strategy-summary">${escapeHtml(strategy.summary || "")}</p>
        <ol class="recommend2-strategy-rules">${rules}</ol>
        <div class="recommend2-pattern-grid">${patterns}</div>
        <div class="recommend2-backtest">
          <p class="recommend2-backtest-title">백테스트 (${escapeHtml(bt.period || "6개월")} · ${escapeHtml(bt.universe || "TOP50")})</p>
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
              <tr>
                <td>A · SMA5 연속 하락</td>
                <td>${escapeHtml(String(rowA.signals ?? "—"))}건</td>
                <td>${escapeHtml(rowA.winRate ?? "—")}</td>
                <td>${escapeHtml(rowA.avgReturn ?? "—")}</td>
                <td>${escapeHtml(rowA.upDayAvg ?? "—")}</td>
                <td>${escapeHtml(rowA.downDayAvg ?? "—")}</td>
              </tr>
              <tr>
                <td>B · SMA5 반등</td>
                <td>${escapeHtml(String(rowB.signals ?? "—"))}건</td>
                <td>${escapeHtml(rowB.winRate ?? "—")}</td>
                <td>${escapeHtml(rowB.avgReturn ?? "—")}</td>
                <td>${escapeHtml(rowB.upDayAvg ?? "—")}</td>
                <td>${escapeHtml(rowB.downDayAvg ?? "—")}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="recommend2-disclaimer">${escapeHtml(strategy.disclaimer || "")}</p>
        </section>
      </details>
    `;
  }

  function mergeSignalLists(...lists) {
    const seen = new Set();
    const out = [];
    for (const list of lists) {
      for (const sig of list || []) {
        const key = `${sig.ticker}|${sig.signalDate}|${sig.pattern}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(sig);
      }
    }
    return out;
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

    const metricsHtml = followUp
      ? `<span>매집신호일 <strong>${escapeHtml(sig.signalDate || "—")}</strong></span>${followUp}`
      : `<span>매집신호일 <strong>${escapeHtml(sig.signalDate || "—")}</strong></span>
          <span>종가 ${formatPrice(sig.close, currency)}</span>
          <span class="${upCls}">당일 ${formatPct(sig.closePct)} (${upLabel})</span>`;

    return `
      <article class="recommend2-card recommend2-card--${sig.pattern}">
        <div class="recommend2-card-header">
          <span class="recommend2-card-pattern">${escapeHtml(sig.patternLabel || sig.pattern)}</span>
          ${nameHtml}
          <span class="recommend2-card-ticker">${escapeHtml(sig.ticker)}</span>
        </div>
        <div class="recommend2-card-metrics">
          ${metricsHtml}
        </div>
        <div class="recommend2-card-detail">
          <span>T-2 거래량 ${formatPct(sig.vol2)} · SMA5 ${formatPct(sig.sma5_2)}</span>
          <span>T-1 거래량 ${formatPct(sig.vol1)} · SMA5 ${formatPct(sig.sma5_1)}</span>
        </div>
      </article>
    `;
  }

  function renderList(listEl, payload, filter) {
    const items = filterSignals(payload, filter);
    const meta = FILTER_META[filter] || FILTER_META.recent;
    const market = resolveMarketPayload(payload, filter).market;
    if (!items.length) {
      let emptyMsg = meta.empty;
      if (filter === "active" && meta.emptyActive) {
        emptyMsg = meta.emptyActive(market || payload);
      }
      listEl.innerHTML = `<p class="recommend2-empty">${emptyMsg}</p>`;
      return;
    }
    listEl.innerHTML = `<div class="recommend2-list">${items.map(renderSignalCard).join("")}</div>`;
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
    const elapsedEl = root.querySelector("#recommend2-update-elapsed");
    if (!elapsedEl) return;
    const sec = Math.max(0, Math.floor((Date.now() - liveUpdateStartedAt) / 1000));
    elapsedEl.textContent = `${sec}초`;
  }

  function setLiveUpdating(root, updating) {
    const panel = root.classList?.contains("recommend2-panel") ? root : root.querySelector(".recommend2-panel");
    const overlay = root.querySelector("#recommend2-update-overlay");
    const refreshBtn = root.querySelector("#recommend2-refresh-btn");

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
    cachedPayload = payload;
    const strategyEl = root.querySelector("#recommend2-strategy-mount");
    if (strategyEl && payload?.strategy) {
      strategyEl.innerHTML = renderStrategyBox(payload.strategy);
    }
    const updatedEl = root.querySelector("#recommend2-updated");
    if (updatedEl) {
      const schedule = payload.updateSchedule || "매일 18:00 (KST) · 장 마감(15:30) 후 T-2·T-1 분석";
      const analysis = payload.analysisDate || payload.latestSignalDate;
      let line = schedule;
      if (payload.updatedAtKst || payload.updatedAt) {
        line += ` · 갱신 ${formatUpdated(payload.updatedAtKst || payload.updatedAt)}`;
      }
      if (analysis) {
        line += ` · 분석 기준일 T-1=${analysis}`;
      }
      updatedEl.textContent = line;
    }
    const listEl = root.querySelector("#recommend2-list");
    const statusEl = root.querySelector("#recommend2-status");
    if (
      activeFilter === "active" &&
      !(payload?.activeSignals || []).length &&
      (payload?.recentSignals || []).length
    ) {
      activeFilter = "recent";
      root.querySelectorAll(".recommend2-tab").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.filter === "recent");
      });
    }
    const items = filterSignals(payload, activeFilter);
    renderList(listEl, payload, activeFilter);
    const meta = FILTER_META[activeFilter] || FILTER_META.recent;
    const market = resolveMarketPayload(payload, activeFilter).market;
    const analysis = market.analysisDate || payload.analysisDate || payload.latestSignalDate || "—";
    const displayDate = market.activeDisplayDate || payload.activeDisplayDate || analysis;
    const universeSize = market.universeSize || 100;
    let statusLine = `${items.length}건 · ${meta.label} ${universeSize}종목`;
    if (meta.window) statusLine += ` · ${meta.window}`;
    if (activeFilter === "active") {
      statusLine += ` · 분석 T-1=${analysis}`;
      if ((market.activeIsFallback ?? payload.activeIsFallback) && displayDate) {
        statusLine += ` · 표시 신호일=${displayDate}`;
      }
    } else if (analysis && analysis !== "—") {
      statusLine += ` · T-1=${analysis}`;
    }
    setStatus(statusEl, statusLine, "info");
  }

  async function loadData(root, options = {}) {
    const listEl = root.querySelector("#recommend2-list");
    const statusEl = root.querySelector("#recommend2-status");
    const forceLive = options.forceLive === true;

    if (!forceLive && cachedPayload) {
      updateView(root, cachedPayload);
      return;
    }

    if (forceLive) {
      setLiveUpdating(root, true);
      setStatus(
        statusEl,
        "실시간 스캔 중… KOSPI·KOSDAQ·NASDAQ·NYSE 종목을 분석하고 있습니다.",
        "info"
      );
      if (!cachedPayload) {
        listEl.innerHTML = `<p class="recommend2-loading">바닥매집 신호를 분석하는 중…</p>`;
      }
    } else {
      listEl.innerHTML = `<p class="recommend2-loading">바닥매집 신호를 분석하는 중…</p>`;
      setStatus(statusEl, "스냅샷 불러오는 중…", "info");
    }

    if (abortController) abortController.abort();
    abortController = new AbortController();

    try {
      let payload;
      if (forceLive && getApiBase()) {
        payload = await Data.fetchLive();
      } else {
        try {
          payload = await Data.fetchStatic(false);
        } catch (_) {
          if (getApiBase()) payload = await Data.fetchLive();
          else throw _;
        }
      }
      updateView(root, payload);
    } catch (err) {
      listEl.innerHTML = `<p class="recommend2-empty">데이터를 불러오지 못했습니다.</p>`;
      setStatus(statusEl, err.message || String(err), "error");
    } finally {
      if (forceLive) setLiveUpdating(root, false);
    }
  }

  function getApiBase() {
    const url = window.STOCK_API_URL;
    if (!url || typeof url !== "string") return null;
    return url.replace(/\/$/, "");
  }

  function mountPage(container) {
    activeFilter = "active";
    cachedPayload = null;

    container.innerHTML = `
      <article class="content-panel recommend2-panel">
        <header class="recommend2-header">
          <div>
            <h2>Stock Picks</h2>
            <p class="recommend2-intro">KOSPI·KOSDAQ TOP 100 · NASDAQ-100 · NYSE TOP 100 · 바닥매집 · DM 소모 없이 열람</p>
          </div>
          <button type="button" class="secondary-btn" id="recommend2-refresh-btn" title="실시간 스캔">Re</button>
        </header>

        <div id="recommend2-strategy-mount"></div>

        <section class="recommend2-filters" aria-label="신호 필터">
          <p class="recommend2-section-label">신호 목록</p>
          <div class="stock-tabs recommend2-tabs" role="tablist">
            <button type="button" class="stock-tab recommend2-tab active" data-filter="active" role="tab">최신 매집</button>
            <button type="button" class="stock-tab recommend2-tab" data-filter="recent" role="tab">KOSPI 최근 2주</button>
            <button type="button" class="stock-tab recommend2-tab" data-filter="kosdaq-2w" role="tab">KOSDAQ 최근 2주</button>
            <button type="button" class="stock-tab recommend2-tab" data-filter="nasdaq-2w" role="tab">NASDAQ 최근 2주</button>
            <button type="button" class="stock-tab recommend2-tab" data-filter="nyse-2w" role="tab">NYSE 최근 2주</button>
          </div>
        </section>

        <p id="recommend2-updated" class="recommend2-updated"></p>
        <div id="recommend2-update-overlay" class="recommend2-update-overlay" hidden role="status" aria-live="polite">
          <span class="recommend2-update-spinner" aria-hidden="true"></span>
          <span class="recommend2-update-label">업데이트중</span>
          <span id="recommend2-update-elapsed" class="recommend2-update-elapsed">0초</span>
          <span class="recommend2-update-hint">서버가 정상 응답하는 중입니다. Render 무료 서버는 첫 요청 시 최대 1~2분 걸릴 수 있습니다.</span>
        </div>
        <p id="recommend2-status" class="recommend2-status" hidden></p>
        <div id="recommend2-list" class="recommend2-list-wrap"></div>
      </article>
    `;

    const root = container.querySelector(".recommend2-panel") || container;
    window.StockStrategyNav?.mount?.(root, "recommend2");

    root.querySelectorAll(".recommend2-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeFilter = btn.dataset.filter || "active";
        root.querySelectorAll(".recommend2-tab").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        if (cachedPayload) updateView(root, cachedPayload);
      });
    });

    root.querySelector("#recommend2-refresh-btn")?.addEventListener("click", () => {
      void loadData(root, { forceLive: true });
    });

    void loadData(root);
  }

  function destroy() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    clearLiveUpdateTimer();
    cachedPayload = null;
  }

  window.Recommend2 = {
    renderPage: mountPage,
    destroy,
    leavePage: destroy
  };
})();
