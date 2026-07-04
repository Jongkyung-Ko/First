/**
 * 장기 추천 — 가이드 탭 + 전략별 데이터 탭 (배당 옆)
 */
(function () {
  const shared = () => window.LongTermShared;
  const data = () => window.LongTermData;

  const MARKET_TABS = [
    { key: "kospi", label: "KOSPI" },
    { key: "kosdaq", label: "KOSDAQ" },
    { key: "nasdaq", label: "NASDAQ" },
    { key: "nyse", label: "NYSE" }
  ];

  const STRATEGY_PAGES = [
    {
      pageId: "long-term-small-cap-pbr",
      strategyId: "small-cap-pbr",
      title: "소형·저PBR",
      intro: "소형주 + 저PBR 장기 스크리닝 · 청크 자동 스캔 · PER/ROE/PBR/배당 탭과 별도",
      spendLabel: "소형·저PBR"
    },
    {
      pageId: "long-term-magic-formula",
      strategyId: "magic-formula",
      title: "마법공식",
      intro: "그린블랫 마법 공식(EBIT/EV + ROC) · 장기 가치·퀄리티",
      spendLabel: "마법공식"
    },
    {
      pageId: "long-term-f-score",
      strategyId: "f-score",
      title: "F-스코어",
      intro: "피오트로스키 F-스코어 9항목 · 재무 개선·건전성",
      spendLabel: "F-스코어"
    }
  ];

  function renderScanProgress(payload, strategyId, market) {
    const cursor = payload?.scanCursor || {};
    const strat = payload?.strategies?.[strategyId];
    const marketBlock = strat?.markets?.[market] || {};
    const offset = marketBlock.offset || 0;
    const universe = strat?.meta?.universeLimit || "—";
    const complete = marketBlock.complete ? "완료" : `진행 ${offset}/${universe}`;
    const rate = marketBlock.recommendRatePct;
    const pickCount = (marketBlock.picks || []).length;
    const rateText = pickCount > 0 ? ` · 추천 ${pickCount}종 (TOP 2)` : "";
    const label =
      STRATEGY_PAGES.find((p) => p.strategyId === strategyId)?.title || strategyId;
    return `
      <p class="long-term-scan-status">
        청크 스캔: <strong>${shared().escapeHtml(label)}</strong>
        · ${shared().escapeHtml(market.toUpperCase())} ${shared().escapeHtml(complete)}${rateText}
        · 다음 커서: ${shared().escapeHtml(cursor.strategyId || "—")} / ${shared().escapeHtml(cursor.market || "—")} offset ${cursor.offset ?? 0}
      </p>`;
  }

  function marketPicks(payload, strategyId, market) {
    const marketBlock = payload?.strategies?.[strategyId]?.markets?.[market] || {};
    const picks = (marketBlock.picks || []).filter(
      (p) => !p.strategyId || p.strategyId === strategyId
    );
    return {
      picks,
      marketBlock,
      interim: !marketBlock.complete && picks.length > 0
    };
  }

  function createGuidePage() {
    const PAGE_ID = "long-term-screens";
    let abortController = null;
    let cachedPayload = null;
    let accessGranted = false;

    function renderGate(container, message, detail) {
      container.innerHTML = `
        <article class="content-panel stock-panel stock-picks-gate recommend2-panel">
          <h2>Stock Picks · 장기추천로직</h2>
          <p class="stock-picks-gate-message">${shared().escapeHtml(message)}</p>
          ${detail ? `<p class="stock-picks-gate-detail">${shared().escapeHtml(detail)}</p>` : ""}
          <p class="stock-picks-gate-hint">열람 Digi-Mon 1개 · 지표·로직 배경 설명</p>
        </article>`;
      window.StockStrategyNav?.mount?.(container.querySelector(".stock-panel"), PAGE_ID);
    }

    async function ensureAccess() {
      const fn = window.Digimon?.spendForStockStrategy;
      if (!fn) return { ok: false, message: "Digi-Mon 모듈을 불러오지 못했습니다.", detail: null };
      const spendResult = await fn(PAGE_ID, "장기추천로직");
      if (!spendResult.ok) {
        return {
          ok: false,
          message: spendResult.error || "열람할 수 없습니다.",
          detail: `보유 Digi-Mon: ${window.Digimon?.format?.(spendResult.balance) ?? 0}개`
        };
      }
      return { ok: true };
    }

    function updateView(root, payload) {
      cachedPayload = payload;
      const guidesEl = root.querySelector("#long-term-guides");
      if (guidesEl) guidesEl.innerHTML = shared().renderAllGuides();

      const updatedEl = root.querySelector("#long-term-updated");
      if (updatedEl) {
        const ts = shared().formatUpdatedNy(payload.lastChunkAt || payload.updatedAt);
        updatedEl.innerHTML = `마지막 갱신 <span class="stock-page-updated-at">${shared().escapeHtml(ts)}</span> · 소형·저PBR / 마법공식 / F-스코어 탭에서 종목 확인`;
      }
    }

    async function loadData(root) {
      if (abortController) abortController.abort();
      abortController = new AbortController();
      try {
        const payload = await data().load({ signal: abortController.signal, preferCache: true, pageId: PAGE_ID });
        updateView(root, payload);
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }

    function mountPage(container) {
      cachedPayload = data().readCache() || null;
      container.innerHTML = `
        <article class="content-panel recommend2-panel long-term-panel long-term-guide-panel">
          <header class="recommend2-header">
            <div>
              <h2>Stock Picks · 장기추천로직</h2>
              <p class="recommend2-intro">PER · ROE · PBR · 배당 + 장기 3전략 — 배경·기술 설명</p>
            </div>
          </header>
          <p id="long-term-updated" class="stock-page-updated">마지막 갱신 <span class="stock-page-updated-at">—</span></p>
          <div id="long-term-guides" class="long-term-guides-page"></div>
        </article>`;

      const root = container.querySelector(".long-term-panel") || container;
      window.StockStrategyNav?.mount?.(root, PAGE_ID);
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
        const access = await ensureAccess();
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
    }

    function destroy() {
      leavePage();
      accessGranted = false;
    }

    return { renderPage, leavePage, destroy };
  }

  function createStrategyPage(pageConfig) {
    const { pageId, strategyId, title, intro, spendLabel } = pageConfig;
    let abortController = null;
    let cachedPayload = null;
    let activeMarket = "kospi";
    let accessGranted = false;

    function renderGate(container, message, detail) {
      container.innerHTML = `
        <article class="content-panel stock-panel stock-picks-gate recommend2-panel">
          <h2>Stock Picks · ${shared().escapeHtml(title)}</h2>
          <p class="stock-picks-gate-message">${shared().escapeHtml(message)}</p>
          ${detail ? `<p class="stock-picks-gate-detail">${shared().escapeHtml(detail)}</p>` : ""}
          <p class="stock-picks-gate-hint">열람 Digi-Mon 1개 · 자동 청크 스캔 (Re 없음)</p>
        </article>`;
      window.StockStrategyNav?.mount?.(container.querySelector(".stock-panel"), pageId);
    }

    async function ensureAccess() {
      const fn = window.Digimon?.spendForStockStrategy;
      if (!fn) return { ok: false, message: "Digi-Mon 모듈을 불러오지 못했습니다.", detail: null };
      const spendResult = await fn(pageId, spendLabel);
      if (!spendResult.ok) {
        return {
          ok: false,
          message: spendResult.error || "열람할 수 없습니다.",
          detail: `보유 Digi-Mon: ${window.Digimon?.format?.(spendResult.balance) ?? 0}개`
        };
      }
      return { ok: true };
    }

    function updateView(root, payload) {
      cachedPayload = payload;
      const guide = shared().STRATEGY_GUIDES.find((g) => g.id === strategyId);
      const hintEl = root.querySelector("#long-term-strategy-hint");
      if (hintEl && guide) {
        hintEl.innerHTML = shared().renderCollapsibleStrategyGuide(guide);
      }

      const updatedEl = root.querySelector("#long-term-updated");
      if (updatedEl) {
        const ts = shared().formatUpdatedNy(payload.lastChunkAt || payload.updatedAt);
        updatedEl.innerHTML = `마지막 갱신 <span class="stock-page-updated-at">${shared().escapeHtml(ts)}</span> · 6시간 간격 자동 스캔`;
      }

      const summaryEl = root.querySelector("#long-term-four-market-summary");
      const fourSummary = payload?.strategies?.[strategyId]?.fourMarketSummary;
      if (summaryEl) {
        summaryEl.innerHTML = fourSummary
          ? `<p class="long-term-four-market-label">4개 시장 추천 종목 (KOSPI·KOSDAQ·NASDAQ·NYSE)</p>${shared().renderFourMarketSummary(fourSummary)}`
          : "";
      }

      const progressEl = root.querySelector("#long-term-progress");
      if (progressEl) progressEl.innerHTML = renderScanProgress(payload, strategyId, activeMarket);

      const { picks, marketBlock, interim } = marketPicks(payload, strategyId, activeMarket);
      const listEl = root.querySelector("#long-term-picks");
      if (listEl) {
        listEl.innerHTML = shared().renderPicksTable(picks, title, {
          interim,
          recommendRatePct: marketBlock.recommendRatePct,
          pickLimit: marketBlock.pickLimit
        });
      }

      const top100El = root.querySelector(".long-term-top100-mount");
      if (top100El) {
        const { items, summary } = shared().resolveTop100Payload(payload, strategyId);
        top100El.innerHTML = shared().renderTop100Table(items, { summary });
      }

      if (payload && window.StockScanLock?.recordPagePayload) {
        window.StockScanLock.recordPagePayload(pageId, payload);
      }
    }

    async function loadData(root) {
      const listEl = root.querySelector("#long-term-picks");
      if (!cachedPayload && listEl) {
        listEl.innerHTML = `<p class="recommend2-loading">데이터를 불러오는 중…</p>`;
      }
      if (abortController) abortController.abort();
      abortController = new AbortController();
      try {
        const payload = await data().load({ signal: abortController.signal, preferCache: true, pageId });
        updateView(root, payload);
      } catch (err) {
        if (err.name === "AbortError") return;
        if (listEl && !cachedPayload) {
          listEl.innerHTML = `<p class="recommend2-empty">불러오지 못했습니다. (${shared().escapeHtml(err.message)})</p>`;
        }
      }
    }

    function mountPage(container) {
      cachedPayload = data().readCache() || null;
      container.innerHTML = `
        <article class="content-panel recommend2-panel long-term-panel">
          <header class="recommend2-header">
            <div>
              <h2>Stock Picks · ${shared().escapeHtml(title)}</h2>
              <p class="recommend2-intro">${shared().escapeHtml(intro)}</p>
            </div>
          </header>
          <p id="long-term-strategy-hint" class="long-term-strategy-hint"></p>
          <p id="long-term-updated" class="stock-page-updated">마지막 갱신 <span class="stock-page-updated-at">—</span></p>
          <div id="long-term-four-market-summary" class="long-term-four-market-summary"></div>
          <p id="long-term-progress" class="long-term-scan-status"></p>
          <section class="recommend2-filters" aria-label="시장 선택">
            <p class="recommend2-section-label">시장</p>
            <div class="stock-tabs recommend2-tabs" role="tablist">
              ${MARKET_TABS.map(
                (t) =>
                  `<button type="button" class="stock-tab recommend2-tab long-term-market-tab${
                    activeMarket === t.key ? " active" : ""
                  }" data-market="${shared().escapeHtml(t.key)}">${shared().escapeHtml(t.label)}</button>`
              ).join("")}
            </div>
          </section>
          <div id="long-term-picks" class="fundamentals-list-wrap"></div>
          ${shared().top100SectionHtml()}
        </article>`;

      const root = container.querySelector(".long-term-panel") || container;
      window.StockStrategyNav?.mount?.(root, pageId);

      root.querySelectorAll(".long-term-market-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeMarket = btn.dataset.market || "kospi";
          root.querySelectorAll(".long-term-market-tab").forEach((b) => {
            b.classList.toggle("active", b === btn);
          });
          if (cachedPayload) updateView(root, cachedPayload);
        });
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
        const access = await ensureAccess();
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
    }

    function destroy() {
      leavePage();
      accessGranted = false;
    }

    return { renderPage, leavePage, destroy };
  }

  const guidePage = createGuidePage();
  window.LongTermScreens = guidePage;
  window.LongTermSmallCapPbr = createStrategyPage(STRATEGY_PAGES[0]);
  window.LongTermMagicFormula = createStrategyPage(STRATEGY_PAGES[1]);
  window.LongTermFScore = createStrategyPage(STRATEGY_PAGES[2]);
})();
