/**
 * Fundamentals pages — PER / ROE / PBR / 배당 (TOP 200 → TOP 20, Re 공통)
 */
(function () {
  const NY_TZ = "America/New_York";
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
        "TOP 200 중 PER(주가수익비율) 낮은 순 TOP 20 · Re 1회로 PER·ROE·PBR·배당 4탭 함께 갱신 · Push 알림 제외",
      spendLabel: "PER"
    },
    {
      pageId: "fundamentals-roe",
      metricId: "roe",
      title: "ROE",
      intro:
        "TOP 200 중 ROE(자기자본이익률) 높은 순 TOP 20 · Re 1회로 4탭 함께 갱신 · Push 알림 제외",
      spendLabel: "ROE"
    },
    {
      pageId: "fundamentals-pbr",
      metricId: "pbr",
      title: "PBR",
      intro:
        "TOP 200 중 PBR(주가순자산비율) 낮은 순 TOP 20 · Re 1회로 4탭 함께 갱신 · Push 알림 제외",
      spendLabel: "PBR"
    },
    {
      pageId: "fundamentals-dividend",
      metricId: "dividend",
      title: "배당수익률",
      intro:
        "TOP 200 중 배당수익률 높은 순 TOP 20 · Re 1회로 4탭 함께 갱신 · Push 알림 제외",
      spendLabel: "배당수익률"
    }
  ];

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
      } else {
        clearLiveUpdateTimer();
        if (overlay) overlay.hidden = true;
        if (refreshBtn) refreshBtn.disabled = false;
      }
    }

    function updateView(root, payload) {
      cachedPayload = dataLayer.pickBetterPayload(cachedPayload, payload);
      dataLayer.writeCaches(cachedPayload);

      const strategyEl = root.querySelector("#fundamentals-meta-mount");
      if (strategyEl && cachedPayload?.strategy) {
        strategyEl.innerHTML = renderStrategyBox(cachedPayload.strategy);
      }

      const updatedEl = root.querySelector("#fundamentals-updated");
      if (updatedEl) {
        const schedule = cachedPayload.updateSchedule || "";
        const ts = formatUpdatedNy(cachedPayload.updatedAtNy || cachedPayload.updatedAt);
        updatedEl.innerHTML =
          `${escapeHtml(schedule)} · 갱신(뉴욕) <span class="stock-picks-updated-at">${escapeHtml(ts)}</span>` +
          ` · <span class="fundamentals-notify-hint">이 지표 추천은 Push 알림에 포함되지 않습니다</span>`;
      }

      const market = cachedPayload?.markets?.[activeMarket] || {};
      const metricLabel = market?.rankings?.[metricId]?.label || title;
      const listEl = root.querySelector("#fundamentals-list");
      if (listEl) {
        listEl.innerHTML = renderMarketTable(market, metricId, metricLabel);
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

      if (forceLive) setLiveUpdating(root, true);
      try {
        const payload = await dataLayer.load({
          forceLive,
          signal: abortController.signal,
          preferCache: !forceLive,
          pageId,
          onProgress: forceLive
            ? (progress) => {
                setStatus(
                  statusEl,
                  `가치·배당 스캔 (${progress.step}/${progress.total}) · ${progress.label} TOP 200…`,
                  "info"
                );
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
          <p class="stock-picks-gate-hint">열람 Digi-Mon 1개 · <strong>Re</strong> 1회로 PER·ROE·PBR·배당 4탭 함께 갱신</p>
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
            <button type="button" class="secondary-btn" id="fundamentals-refresh-btn" title="PER·ROE·PBR·배당 4탭 함께 갱신">Re</button>
          </header>
          <div id="fundamentals-meta-mount"></div>
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
          <p id="fundamentals-updated" class="recommend2-updated"></p>
          <div id="fundamentals-update-overlay" class="recommend2-update-overlay" hidden role="status" aria-live="polite">
            <span class="recommend2-update-spinner" aria-hidden="true"></span>
            <span class="recommend2-update-label">4탭 공통 업데이트중</span>
            <span id="fundamentals-update-elapsed" class="recommend2-update-elapsed">0초</span>
            <span class="recommend2-update-hint">시장당 TOP 200 재무 조회 · 4시장 순차 (총 10~25분 가능). Render 무료 서버는 첫 요청이 더 걸릴 수 있습니다.</span>
          </div>
          <p id="fundamentals-status" class="recommend2-status" hidden></p>
          <div id="fundamentals-list" class="fundamentals-list-wrap"></div>
        </article>`;

      const root = container.querySelector(".recommend2-panel") || container;
      activeRoot = root;
      scanStatusUnbind?.();
      scanStatusUnbind =
        window.StockScanLock?.bindScanStatus?.(pageId, (msg, kind, busy, startedAtMs) => {
          const el = root.querySelector("#fundamentals-status");
          if (!busy) {
            setLiveUpdating(root, false);
            return;
          }
          setStatus(el, msg, kind || "info");
          setLiveUpdating(root, true, { startedAtMs });
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
        const session = window.Auth?.getSession?.();
        if (!session) {
          setStatus(root.querySelector("#fundamentals-status"), "로그인이 필요합니다.", "error");
          return;
        }
        if (window.StockScanLock && !(await window.StockScanLock.guardReClick())) {
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
