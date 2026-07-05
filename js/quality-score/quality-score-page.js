/**
 * 재무 종합 점수 페이지 — TOP 100 전체 순위
 */
(function () {
  const PAGE_ID = "quality-score";
  const MARKET_TABS = [
    { key: "kospi", label: "KOSPI" },
    { key: "kosdaq", label: "KOSDAQ" },
    { key: "nasdaq", label: "NASDAQ" },
    { key: "nyse", label: "NYSE" }
  ];

  const GRADE_LABELS = ["", "위험", "주의", "보통", "우수", "최우수"];
  let accessGranted = false;
  let activeMarket = "kospi";
  let cachedPayload = null;
  let liveUpdateTimerId = null;
  let liveUpdateStartedAt = 0;
  let scanStatusUnbind = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtPct(v) {
    if (v == null || v === "") return "—";
    const n = Number(v);
    if (Number.isNaN(n)) return "—";
    return `${n.toFixed(1)}%`;
  }

  function gradeClass(g) {
    const n = Number(g) || 1;
    return `qs-grade qs-grade-${n}`;
  }

  function gradeCell(g) {
    const n = Number(g) || 1;
    return `<span class="${gradeClass(n)}" title="${escapeHtml(GRADE_LABELS[n] || "")}">${n}</span>`;
  }

  function formatUpdated(payload) {
    const ts = payload?.updatedAtKst || payload?.updatedAt || payload?.updatedAtNy;
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    } catch {
      return ts;
    }
  }

  function renderMarketTabs() {
    return MARKET_TABS.map(
      (t) =>
        `<button type="button" class="fundamentals-market-tab${t.key === activeMarket ? " active" : ""}" data-market="${t.key}">${t.label}</button>`
    ).join("");
  }

  function renderTable(items) {
    if (!items?.length) {
      return `<p class="fundamentals-empty">데이터가 없습니다. 매일 02:00·03:00 자동 갱신 후 표시됩니다.</p>`;
    }
    const rows = items
      .map((row) => {
        const g = row.grades || {};
        return `<tr>
          <td class="qs-rank">${row.rank ?? "—"}</td>
          <td class="qs-name">${escapeHtml(row.name)}<br><span class="qs-ticker">${escapeHtml(row.ticker)}</span></td>
          <td class="qs-composite"><strong>${row.compositeScore ?? "—"}</strong><span class="qs-composite-max">/25</span></td>
          <td>${fmtPct(row.roe)} ${gradeCell(g.roe)}</td>
          <td>${fmtPct(row.operatingMargin)} ${gradeCell(g.operatingMargin)}</td>
          <td>${fmtPct(row.debtRatio)} ${gradeCell(g.debt)}</td>
          <td>${fmtPct(row.fcfYield)} ${gradeCell(g.fcf)}</td>
          <td>${fmtPct(row.epsGrowth)} ${gradeCell(g.epsGrowth)}</td>
        </tr>`;
      })
      .join("");
    return `
      <div class="fundamentals-table-wrap quality-score-table-wrap">
        <table class="recommend2-match-table fundamentals-table quality-score-table">
          <thead>
            <tr>
              <th>순위</th>
              <th>종목</th>
              <th>종합</th>
              <th>ROE</th>
              <th>영업이익률</th>
              <th>부채비율</th>
              <th>FCF수익률</th>
              <th>EPS성장</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderGuide() {
    return `
      <details class="long-term-guide-details quality-score-guide">
        <summary class="long-term-guide-summary">등급 기준 · 계산 방식</summary>
        <div class="long-term-guide-body">
          <p><strong>종합점수</strong> = ROE + 영업이익률 + 부채비율 + FCF수익률 + EPS성장 등급 합 (5~25)</p>
          <table class="recommend2-match-table fundamentals-table qs-grade-table">
            <thead><tr><th>등급</th><th>ROE·영업이익률</th><th>부채비율</th><th>FCF÷시총</th><th>EPS성장</th></tr></thead>
            <tbody>
              <tr><td>5 최우수</td><td>&gt;20%</td><td>&lt;50%</td><td>≥6%</td><td>&gt;15%</td></tr>
              <tr><td>4 우수</td><td>15~20%</td><td>50~100%</td><td>3~6%</td><td>10~15%</td></tr>
              <tr><td>3 보통</td><td>10~15%</td><td>100~150%</td><td>1~3%</td><td>5~10%</td></tr>
              <tr><td>2 주의</td><td>5~10%</td><td>150~200%</td><td>0~1%</td><td>0~5%</td></tr>
              <tr><td>1 위험</td><td>&lt;5%</td><td>&gt;200%</td><td>적자/없음</td><td>&lt;0%</td></tr>
            </tbody>
          </table>
          <p class="long-term-guide-caution">금융주 부채비율 누락 시 부채 등급 3(보통). Yahoo Finance 기준 · 투자 권유 아님.</p>
          <p><strong>갱신</strong> KOSPI·KOSDAQ 02:00·03:00 KST · NASDAQ·NYSE 02:00·03:00 뉴욕(ET) · 시장별 50종목씩 2회 청크</p>
        </div>
      </details>`;
  }

  function updateView(root, payload) {
    const block = payload?.markets?.[activeMarket];
    const mount = root.querySelector(".quality-score-mount");
    const metaEl = root.querySelector(".quality-score-meta");
    if (mount) mount.innerHTML = renderTable(block?.items || []);
    if (metaEl) {
      const ready = block?.qualityReady ? "완료" : `진행 ${block?.scannedCount || 0}/${block?.universeSize || 100}`;
      metaEl.textContent = `갱신: ${formatUpdated(payload)} · ${activeMarket.toUpperCase()} ${ready}`;
    }
  }

  function renderGate(container, message, detail) {
    container.innerHTML = `
      <article class="content-panel stock-panel stock-picks-gate recommend2-panel">
        <h2>Stock Picks · 재무종합</h2>
        <p class="stock-picks-gate-message">${escapeHtml(message)}</p>
        ${detail ? `<p class="stock-picks-gate-detail">${escapeHtml(detail)}</p>` : ""}
        <p class="stock-picks-gate-hint">열람 Digi-Mon 1개 · TOP 100 재무 등급 순위</p>
      </article>`;
    window.StockStrategyNav?.mount?.(container.querySelector(".stock-panel"), PAGE_ID);
  }

  async function ensureAccess() {
    const fn = window.Digimon?.spendForStockStrategy;
    if (!fn) return { ok: false, message: "Digi-Mon 모듈을 불러오지 못했습니다.", detail: null };
    const spendResult = await fn(PAGE_ID, "재무종합");
    if (!spendResult.ok) {
      return {
        ok: false,
        message: spendResult.error || "열람할 수 없습니다.",
        detail: `보유 Digi-Mon: ${window.Digimon?.format?.(spendResult.balance) ?? 0}개`
      };
    }
    return { ok: true };
  }

  function clearLiveUpdateTimer() {
    if (liveUpdateTimerId != null) {
      clearInterval(liveUpdateTimerId);
      liveUpdateTimerId = null;
    }
  }

  function tickLiveUpdateElapsed(root) {
    const elapsedEl = root.querySelector("#quality-score-update-elapsed");
    if (!elapsedEl) return;
    const sec = Math.max(0, Math.floor((Date.now() - liveUpdateStartedAt) / 1000));
    elapsedEl.textContent = `${sec}초`;
  }

  function setOverlayStep(root, text) {
    const stepEl = root.querySelector("#quality-score-update-step");
    if (stepEl && text) stepEl.textContent = text;
  }

  function setLiveUpdating(root, updating, opts = {}) {
    const panel = root.classList?.contains("quality-score-panel") ? root : root.querySelector(".quality-score-panel");
    const overlay = root.querySelector("#quality-score-update-overlay");
    const alreadyUpdating =
      !!panel?.classList.contains("recommend2-panel--updating") && liveUpdateTimerId != null;

    if (panel) panel.classList.toggle("recommend2-panel--updating", updating);

    if (updating) {
      const serverMs = opts.startedAtMs;
      if (serverMs != null && Number.isFinite(serverMs)) {
        if (!alreadyUpdating || serverMs < liveUpdateStartedAt) {
          liveUpdateStartedAt = serverMs;
        }
      } else if (!alreadyUpdating) {
        liveUpdateStartedAt = Date.now();
      }
      if (opts.stepLabel) setOverlayStep(root, opts.stepLabel);
      tickLiveUpdateElapsed(root);
      if (!alreadyUpdating) {
        clearLiveUpdateTimer();
        liveUpdateTimerId = setInterval(() => tickLiveUpdateElapsed(root), 1000);
      }
      if (overlay) overlay.hidden = false;
    } else if (window.StockScanLock?.isAnyScanBusy?.()) {
      const state = window.StockScanLock.getGlobalScanState();
      setLiveUpdating(root, true, {
        startedAtMs: state.startedAtMs,
        stepLabel: state.message
      });
    } else {
      clearLiveUpdateTimer();
      if (overlay) overlay.hidden = true;
      setOverlayStep(root, "업데이트중");
    }
  }

  function mountPage(container) {
    container.innerHTML = `
      <article class="content-panel recommend2-panel quality-score-panel">
        <header class="recommend2-header">
          <div>
            <h2>Stock Picks · 재무종합</h2>
            <p class="recommend2-intro">시가총액 TOP 100 · ROE·영업이익률·부채비율·FCF·EPS성장 5지표 등급 합산 순위 · Push 알림 제외</p>
          </div>
        </header>
        <p class="quality-score-meta stock-page-updated">불러오는 중…</p>
        <section class="recommend2-filters" aria-label="시장 선택">
          <p class="recommend2-section-label">시장 · TOP 100 전체 순위</p>
          <div class="stock-tabs recommend2-tabs" role="tablist">${renderMarketTabs()}</div>
        </section>
        <div id="quality-score-update-overlay" class="recommend2-update-overlay" hidden role="status" aria-live="polite">
          <span class="recommend2-update-spinner" aria-hidden="true"></span>
          <span class="recommend2-update-label" id="quality-score-update-step">업데이트중</span>
          <span id="quality-score-update-elapsed" class="recommend2-update-elapsed">0초</span>
        </div>
        <div class="quality-score-mount"></div>
        ${renderGuide()}
      </article>`;

    const root = container.querySelector(".quality-score-panel") || container;
    window.StockStrategyNav?.mount?.(root, PAGE_ID);

    scanStatusUnbind?.();
    scanStatusUnbind =
      window.StockScanLock?.bindScanStatus?.(PAGE_ID, (msg, _kind, busy, startedAtMs, scanState) => {
        if (!busy) {
          setLiveUpdating(root, false);
          return;
        }
        setLiveUpdating(root, true, {
          startedAtMs,
          stepLabel: scanState?.message || msg
        });
      }) || null;

    if (window.StockScanLock?.isAnyScanBusy?.()) {
      const state = window.StockScanLock.getGlobalScanState();
      setLiveUpdating(root, true, {
        startedAtMs: state.startedAtMs,
        stepLabel: state.message
      });
    }

    root.querySelectorAll(".fundamentals-market-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeMarket = btn.dataset.market || "kospi";
        root.querySelectorAll(".fundamentals-market-tab").forEach((b) => {
          b.classList.toggle("active", b.dataset.market === activeMarket);
        });
        if (cachedPayload) updateView(root, cachedPayload);
      });
    });

    if (cachedPayload) updateView(root, cachedPayload);
    void window.QualityScoreData.loadPayload().then((payload) => {
      cachedPayload = payload;
      updateView(root, payload);
    });
  }

  async function renderPage(container) {
    if (!accessGranted) {
      const session = window.Auth?.getSession?.();
      if (!session) {
        renderGate(container, "로그인이 필요합니다.", "로그인 후 Digi-Mon 1개로 열람할 수 있습니다.");
        return;
      }
      const access = await ensureAccess();
      if (!access.ok) {
        renderGate(container, access.message, access.detail);
        return;
      }
      accessGranted = true;
    }
    mountPage(container);
  }

  function destroy() {
    scanStatusUnbind?.();
    scanStatusUnbind = null;
    clearLiveUpdateTimer();
    accessGranted = false;
    cachedPayload = null;
  }

  window.QualityScorePage = { renderPage, destroy };
})();
