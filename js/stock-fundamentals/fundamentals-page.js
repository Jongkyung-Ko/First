/**
 * Fundamentals pages — PER / ROE / PBR / 배당 (TOP 200 → TOP 20, Re 공통)
 */
(function () {
  const NY_TZ = "America/New_York";
  const KST_TZ = "Asia/Seoul";
  const KR_MARKET_KEYS = new Set(["kospi", "kosdaq"]);
  const MARKET_TABS = [
    { key: "kospi", label: "KOSPI" },
    { key: "kosdaq", label: "KOSDAQ" },
    { key: "nasdaq", label: "NASDAQ" },
    { key: "nyse", label: "NYSE" }
  ];

  const METRIC_PAGES = [
    {
      pageId: "fundamentals-per",
      metricId: "per",
      title: "PER",
      intro:
        "TOP 200 중 PER(주가수익비율) 낮은 순 TOP 20 · 매일 장 마감 후 자동 갱신 · Push 알림 제외",
      spendLabel: "PER"
    },
    {
      pageId: "fundamentals-roe",
      metricId: "roe",
      title: "ROE",
      intro:
        "TOP 200 중 ROE(자기자본이익률) 높은 순 TOP 20 · 매일 장 마감 후 자동 갱신 · Push 알림 제외",
      spendLabel: "ROE"
    },
    {
      pageId: "fundamentals-pbr",
      metricId: "pbr",
      title: "PBR",
      intro:
        "TOP 200 중 PBR(주가순자산비율) 낮은 순 TOP 20 · 매일 장 마감 후 자동 갱신 · Push 알림 제외",
      spendLabel: "PBR"
    },
    {
      pageId: "fundamentals-dividend",
      metricId: "dividend",
      title: "배당수익률",
      intro:
        "TOP 200 중 배당수익률 높은 순 TOP 20 · 매일 장 마감 후 자동 갱신 · Push 알림 제외",
      spendLabel: "배당수익률"
    }
  ];

  function normalizeFundamentalsEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function canFundamentalsRe(session) {
    const allowed = normalizeFundamentalsEmail(
      window.FUNDAMENTALS_FORCE_EMAIL || "maspro79@naver.com"
    );
    return normalizeFundamentalsEmail(session?.user?.email) === allowed;
  }

  function syncFundamentalsReButton(root) {
    const btn = root.querySelector("#fundamentals-refresh-btn");
    if (!btn) return;
    const session = window.Auth?.getSession?.();
    if (!session) {
      btn.title = "로그인 필요";
      return;
    }
    if (!canFundamentalsRe(session)) {
      btn.title = "권한없음";
      return;
    }
    btn.title = "열린 시장만 갱신 · 휴장 시 현재 탭 시장 (관리자)";
  }

  function describeReScanScope(activeMarket) {
    const lock = window.StockScanLock;
    if (!lock?.resolveOpenMarketScanSteps) {
      return { label: "가치·배당", mode: "open" };
    }
    const scope = lock.resolveOpenMarketScanSteps(lock.LIVE_SCAN_STEPS, activeMarket);
    if (scope.mode === "fallback") {
      const tab = MARKET_TABS.find((t) => t.key === scope.fallbackMarket);
      return {
        label: tab?.label || scope.fallbackMarket?.toUpperCase() || "KOSPI",
        mode: "fallback"
      };
    }
    const labels = scope.steps.map((step) => step.label).join("·");
    return { label: labels || "열린 시장", mode: "open" };
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

  function formatPrice(value, currency) {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    const n = Number(value);
    if (currency === "USD") {
      return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}원`;
  }

  function formatUpdatedForMarket(iso, marketKey) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const isKr = KR_MARKET_KEYS.has(marketKey);
    return d.toLocaleString("ko-KR", {
      timeZone: isKr ? KST_TZ : NY_TZ,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short"
    });
  }

  function scheduleForMarket(marketKey, payload) {
    const block = payload?.markets?.[marketKey];
    if (block?.updateSchedule) return block.updateSchedule;
    const region = payload?.regions?.[marketKey];
    if (region?.updateSchedule) return region.updateSchedule;
    if (KR_MARKET_KEYS.has(marketKey)) {
      return "매일 20:30 (KST) · 장 마감(15:30) 후 자동 갱신";
    }
    return "매일 21:30 (뉴욕 ET) · 장 마감(16:00 ET) 후 자동 갱신";
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
        <summary class="recommend2-strategy-summary-toggle">지표 설명 · ${escapeHtml(strategy.title || "")}</summary>
        <section class="recommend2-strategy-box" aria-label="가치·배당 지표">
          <h3 class="recommend2-strategy-title">${escapeHtml(strategy.title || "")}</h3>
          <p class="recommend2-strategy-universe">${escapeHtml(strategy.universe || "")}</p>
          <p class="recommend2-strategy-summary">${escapeHtml(strategy.summary || "")}</p>
          <ol class="recommend2-strategy-rules">${rules}</ol>
          <div class="recommend2-pattern-grid">${patterns}</div>
          <p class="recommend2-disclaimer">${escapeHtml(strategy.disclaimer || "")}</p>
        </section>
      </details>`;
  }

  function renderRow(item, metricId) {
    const currency = item.currency || (isKrTicker(item.ticker) ? "KRW" : "USD");
    const link = stockLink(item.ticker);
    const nameHtml = link
      ? `<a href="${link}" target="_blank" rel="noopener noreferrer" class="recommend2-card-name">${escapeHtml(item.name)}</a>`
      : `<span class="recommend2-card-name">${escapeHtml(item.name)}</span>`;
    const extras = [];
    if (metricId !== "per" && item.trailingPE != null) {
      extras.push(`PER ${escapeHtml(String(item.trailingPE))}`);
    }
    if (metricId !== "roe" && item.returnOnEquity != null) {
      extras.push(`ROE ${(Number(item.returnOnEquity) * 100).toFixed(1)}%`);
    }
    if (metricId !== "pbr" && item.priceToBook != null) {
      extras.push(`PBR ${escapeHtml(String(item.priceToBook))}`);
    }
    if (metricId !== "dividend" && item.dividendYield != null) {
      extras.push(`배당 ${(Number(item.dividendYield) * 100).toFixed(2)}%`);
    }
    return `
      <tr>
        <td class="fundamentals-rank">${item.rank}</td>
        <td>${nameHtml}<span class="recommend2-card-ticker">${escapeHtml(item.ticker)}</span></td>
        <td class="fundamentals-metric"><strong>${escapeHtml(item.displayValue || "—")}</strong></td>
        <td>${formatPrice(item.price, currency)}</td>
        <td class="fundamentals-extra">${extras.join(" · ") || "—"}</td>
      </tr>`;
  }

  function renderMarketTable(marketBlock, metricId, metricLabel) {
    const ranking = marketBlock?.rankings?.[metricId];
    const items = ranking?.items || [];
    if (!items.length) {
      return `<p class="recommend2-empty">${escapeHtml(metricLabel)} 순위 데이터가 없습니다. (Yahoo 재무값 누락 가능)</p>`;
    }
    return `
      <div class="fundamentals-table-wrap">
        <table class="recommend2-match-table fundamentals-table">
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col">종목</th>
              <th scope="col">${escapeHtml(metricLabel)}</th>
              <th scope="col">주가</th>
              <th scope="col">기타 지표</th>
            </tr>
          </thead>
          <tbody>${items.map((item) => renderRow(item, metricId)).join("")}</tbody>
        </table>
      </div>`;
  }

  function createFundamentalsPage(pageConfig) {
    const { pageId, metricId, title, intro, spendLabel } = pageConfig;
    const dataLayer = window.StockFundamentalsData?.shared;

    let abortController = null;
    let cachedPayload = null;
    let activeMarket = "kospi";
    let liveUpdateTimerId = null;
    let liveUpdateStartedAt = 0;
    let accessGranted = false;
    let activeRoot = null;
    let scanStatusUnbind = null;
    let forceLiveActive = false;

    function applyPartial(partial) {
      const next = dataLayer.pickBetterPayload(cachedPayload, partial);
      cachedPayload = next;
      dataLayer.writeCaches(next);
      if (activeRoot?.isConnected) updateView(activeRoot, next);
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
      const elapsedEl = root.querySelector("#fundamentals-update-elapsed");
      if (!elapsedEl) return;
      const sec = Math.max(0, Math.floor((Date.now() - liveUpdateStartedAt) / 1000));
      elapsedEl.textContent = `${sec}초`;
    }

    function setOverlayStep(root, text) {
      const stepEl = root.querySelector("#fundamentals-update-step");
      if (stepEl && text) stepEl.textContent = text;
    }

    function shouldShowUpdatingOverlay() {
      return forceLiveActive || !!window.StockScanLock?.shouldKeepLiveScan?.(pageId);
    }

    function setLiveUpdating(root, updating, opts = {}) {
      const panel = root.classList?.contains("recommend2-panel") ? root : root.querySelector(".recommend2-panel");
      const overlay = root.querySelector("#fundamentals-update-overlay");
      const refreshBtn = root.querySelector("#fundamentals-refresh-btn");
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
        if (alreadyUpdating) {
          tickLiveUpdateElapsed(root);
          if (overlay) overlay.hidden = false;
          if (refreshBtn) refreshBtn.disabled = true;
          return;
        }
        tickLiveUpdateElapsed(root);
        clearLiveUpdateTimer();
        liveUpdateTimerId = setInterval(() => tickLiveUpdateElapsed(root), 1000);
        if (overlay) overlay.hidden = false;
        if (refreshBtn) refreshBtn.disabled = true;
        if (opts.stepLabel) setOverlayStep(root, opts.stepLabel);
      } else {
        if (shouldShowUpdatingOverlay()) {
          if (overlay) overlay.hidden = false;
          if (refreshBtn) refreshBtn.disabled = true;
          return;
        }
        clearLiveUpdateTimer();
        if (overlay) overlay.hidden = true;
        if (refreshBtn) refreshBtn.disabled = false;
        setOverlayStep(root, "4탭 공통 업데이트중");
      }
    }

    function updateView(root, payload) {
      cachedPayload = dataLayer.pickBetterPayload(cachedPayload, payload);
      dataLayer.writeCaches(cachedPayload);

      const updatedEl = root.querySelector("#fundamentals-updated");
      if (updatedEl) {
        const schedule = scheduleForMarket(activeMarket, cachedPayload);
        const isKr = KR_MARKET_KEYS.has(activeMarket);
        const tsIso = isKr
          ? cachedPayload.updatedAtKst ||
            cachedPayload.regions?.[activeMarket]?.updatedAtKst ||
            cachedPayload.updatedAt
          : cachedPayload.updatedAtNy || cachedPayload.updatedAt;
        const ts = formatUpdatedForMarket(tsIso, activeMarket);
        updatedEl.innerHTML =
          `마지막 갱신 <span class="stock-page-updated-at">${escapeHtml(ts)}</span>` +
          (schedule ? ` · ${escapeHtml(schedule)}` : "") +
          ` · <span class="fundamentals-notify-hint">지표·로직 배경 설명은 <strong>장기추천로직</strong> 탭 · Push 알림 제외</span>`;
      }

      const hintEl = root.querySelector("#fundamentals-update-hint");
      if (hintEl) {
        const krHint = KR_MARKET_KEYS.has(activeMarket);
        hintEl.textContent = krHint
          ? "매일 20:30 (KST) 자동 갱신 · Re=열린 시장(휴장 시 현재 탭)"
          : "매일 21:30 (뉴욕 ET) 자동 갱신 · Re=열린 시장(휴장 시 현재 탭)";
      }

      const market = cachedPayload?.markets?.[activeMarket] || {};
      const metricLabel = market?.rankings?.[metricId]?.label || title;
      const listEl = root.querySelector("#fundamentals-list");
      if (listEl) {
        listEl.innerHTML = renderMarketTable(market, metricId, metricLabel);
      }

      const histEl = root.querySelector(".stock-rec-history-mount");
      if (histEl && window.StockRecommendationHistory) {
        histEl.innerHTML = window.StockRecommendationHistory.renderHistoryTable(
          cachedPayload.history || [],
          { strategyId: `fundamentals-${metricId}` }
        );
      }

      const statusEl = root.querySelector("#fundamentals-status");
      const count = market?.rankings?.[metricId]?.count || 0;
      const scanned = market?.scannedCount ?? "—";
      const universe = market?.universeSize ?? 200;
      setStatus(
        statusEl,
        `${metricLabel} TOP ${count} · ${activeMarket.toUpperCase()} (스캔 ${scanned}/${universe})`,
        null
      );
      if (cachedPayload && !dataLayer.isPlaceholderPayload?.(cachedPayload)) {
        window.StockScanLock?.recordPagePayload?.(pageId, cachedPayload);
      }
    }

    async function loadData(root, { forceLive = false } = {}) {
      const listEl = root.querySelector("#fundamentals-list");
      const statusEl = root.querySelector("#fundamentals-status");

      if (!forceLive && window.StockScanLock?.shouldKeepLiveScan?.(pageId)) {
        activeRoot = root;
        const prior = cachedPayload || dataLayer.readBestCache?.();
        if (prior) {
          cachedPayload = prior;
          updateView(root, prior);
        }
        setLiveUpdating(root, true, { stepLabel: "가치·배당 스캔 진행 중…" });
        return;
      }

      const prior = cachedPayload || dataLayer.readBestCache?.();
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

      const reScope = forceLive ? describeReScanScope(activeMarket) : null;
      if (forceLive) {
        forceLiveActive = true;
        const prep =
          reScope?.mode === "fallback"
            ? `휴장 · ${reScope.label} TOP 200 준비 중…`
            : `열린 시장 · ${reScope?.label || "가치·배당"} 준비 중…`;
        setLiveUpdating(root, true, { stepLabel: prep });
      }
      try {
        const payload = await dataLayer.load({
          forceLive,
          signal: abortController.signal,
          preferCache: !forceLive,
          pageId,
          activeMarket,
          onProgress: forceLive
            ? (progress) => {
                const scopeHint =
                  reScope?.mode === "fallback" ? "휴장·현재 탭" : "열린 시장";
                const stepLabel = `${scopeHint} (${progress.step}/${progress.total}) · ${progress.label} TOP 200`;
                setOverlayStep(root, stepLabel);
                setStatus(statusEl, `${stepLabel}…`, "info");
              }
            : undefined,
          onPartial: forceLive ? (partial) => applyPartial(partial) : undefined
        });
        updateView(root, dataLayer.pickBetterPayload(cachedPayload, payload));
      } catch (err) {
        if (err.name === "AbortError") return;
        if (err.code === "scan_busy_blocked") {
          setStatus(statusEl, "이미 스캔 중입니다.", "info");
          return;
        }
        if (!cachedPayload) {
          listEl.innerHTML = `<p class="recommend2-empty">데이터를 불러오지 못했습니다.</p>`;
          setStatus(statusEl, err.message || String(err), "error");
        } else {
          setStatus(statusEl, `갱신 실패 · 이전 데이터 표시 (${err.message || err})`, "error");
        }
      } finally {
        if (forceLive) {
          forceLiveActive = false;
          setLiveUpdating(root, false);
          await window.Digimon?.refresh?.();
          await window.StockScanLock?.refreshMeta?.();
        }
      }
    }

    function renderGate(container, message, detail) {
      container.innerHTML = `
        <article class="content-panel stock-panel stock-picks-gate recommend2-panel">
          <h2>Stock Picks · ${escapeHtml(title)}</h2>
          <p class="stock-picks-gate-message">${escapeHtml(message)}</p>
          ${detail ? `<p class="stock-picks-gate-detail">${escapeHtml(detail)}</p>` : ""}
          <p class="stock-picks-gate-hint">열람 Digi-Mon 1개 · 데이터는 매일 장 마감 후 자동 갱신</p>
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
      const spendResult = await fn("fundamentals", spendLabel);
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
      activeMarket = "kospi";
      cachedPayload = dataLayer.readBestCache?.() || null;

      container.innerHTML = `
        <article class="content-panel recommend2-panel fundamentals-panel">
          <header class="recommend2-header">
            <div>
              <h2>Stock Picks · ${escapeHtml(title)}</h2>
              <p class="recommend2-intro">${escapeHtml(intro)}</p>
            </div>
            <button type="button" class="secondary-btn" id="fundamentals-refresh-btn" title="열린 시장만 갱신 · 휴장 시 현재 탭">Re</button>
          </header>
          <p id="fundamentals-updated" class="stock-page-updated">마지막 갱신 <span class="stock-page-updated-at">—</span></p>
          <section class="recommend2-filters" aria-label="시장 선택">
            <p class="recommend2-section-label">시장 · TOP 200 → TOP 20</p>
            <div class="stock-tabs recommend2-tabs" role="tablist">
              ${MARKET_TABS.map(
                (t) =>
                  `<button type="button" class="stock-tab recommend2-tab fundamentals-market-tab${
                    activeMarket === t.key ? " active" : ""
                  }" data-market="${escapeHtml(t.key)}">${escapeHtml(t.label)}</button>`
              ).join("")}
            </div>
          </section>
          <div id="fundamentals-update-overlay" class="recommend2-update-overlay" hidden role="status" aria-live="polite">
            <span class="recommend2-update-spinner" aria-hidden="true"></span>
            <span class="recommend2-update-label" id="fundamentals-update-step">4탭 공통 업데이트중</span>
            <span id="fundamentals-update-elapsed" class="recommend2-update-elapsed">0초</span>
            <span id="fundamentals-update-hint" class="recommend2-update-hint">매일 20:30 (KST) 자동 갱신 · Re=열린 시장(휴장 시 현재 탭)</span>
          </div>
          <p id="fundamentals-status" class="recommend2-status" hidden></p>
          <div id="fundamentals-list" class="fundamentals-list-wrap"></div>
          <section class="long-term-history-section stock-rec-history-section">
            <h3 class="long-term-history-heading">추천 이력 (최근 100건)</h3>
            <div class="stock-rec-history-mount"></div>
          </section>
        </article>`;

      const root = container.querySelector(".recommend2-panel") || container;
      activeRoot = root;
      scanStatusUnbind?.();
      scanStatusUnbind =
        window.StockScanLock?.bindScanStatus?.(pageId, (msg, kind, busy, startedAtMs) => {
          const el = root.querySelector("#fundamentals-status");
          if (!busy) {
            if (shouldShowUpdatingOverlay()) {
              setLiveUpdating(root, true, { startedAtMs });
              return;
            }
            setLiveUpdating(root, false);
            return;
          }
          setStatus(el, msg, kind || "info");
          setLiveUpdating(root, true, { startedAtMs, stepLabel: msg || undefined });
        }) || null;
      window.StockStrategyNav?.mount?.(root, pageId);

      root.querySelectorAll(".fundamentals-market-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeMarket = btn.dataset.market || "kospi";
          root.querySelectorAll(".fundamentals-market-tab").forEach((b) => {
            b.classList.toggle("active", b === btn);
          });
          if (cachedPayload) updateView(root, cachedPayload);
        });
      });

      root.querySelector("#fundamentals-refresh-btn")?.addEventListener("click", async () => {
        const statusEl = root.querySelector("#fundamentals-status");
        const session = window.Auth?.getSession?.();
        if (!session) {
          setStatus(statusEl, "로그인이 필요합니다.", "error");
          return;
        }
        if (!canFundamentalsRe(session)) {
          setStatus(statusEl, "권한없음", "error");
          return;
        }
        forceLiveActive = true;
        setLiveUpdating(root, true, { stepLabel: "Re 요청 중…" });
        if (window.StockScanLock && !(await window.StockScanLock.guardReClick())) {
          forceLiveActive = false;
          setLiveUpdating(root, false);
          return;
        }
        void loadData(root, { forceLive: true });
      });

      syncFundamentalsReButton(root);

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
    }

    return { renderPage, leavePage, destroy };
  }

  const pages = {};
  METRIC_PAGES.forEach((cfg) => {
    pages[cfg.metricId] = createFundamentalsPage(cfg);
    const exportName =
      cfg.metricId === "per"
        ? "StockFundamentalsPer"
        : cfg.metricId === "roe"
          ? "StockFundamentalsRoe"
          : cfg.metricId === "pbr"
            ? "StockFundamentalsPbr"
            : "StockFundamentalsDividend";
    window[exportName] = pages[cfg.metricId];
  });

  window.StockFundamentalsPages = pages;
})();
