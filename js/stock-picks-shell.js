/**
 * Stock Picks — 2단 셸 (상단: 추천 방식 · 하단: 결과)
 */
(function () {
  const S = window.DwStockPicksShared;
  if (!S) {
    console.warn("DwStockPicks: DwStockPicksShared not loaded");
    return;
  }

  let activeStrategyId = null;
  let activeMarket = null;
  let mountedRoot = null;

  function getStrategies() {
    return window.DwPickStrategies || [];
  }

  function getStrategy(id) {
    return getStrategies().find((s) => s.id === id) || null;
  }

  function escapeHtml(text) {
    return S.escapeHtml(text);
  }

  function readInitialStrategyId() {
    try {
      const hash = window.location.hash || "";
      const qIndex = hash.indexOf("?");
      if (qIndex >= 0) {
        const params = new URLSearchParams(hash.slice(qIndex + 1));
        const fromHash = params.get("strategy");
        if (fromHash) return fromHash;
      }
      const pageParams = new URLSearchParams(window.location.search);
      return pageParams.get("strategy");
    } catch (_) {
      return null;
    }
  }

  async function ensureStockPicksAccess() {
    if (S.isGuestMode()) {
      return { ok: true, guest: true };
    }
    if (!window.Digimon?.spendForStockPicks) {
      return { ok: false, message: "Digi-Mon 모듈을 불러오지 못했습니다.", detail: null };
    }
    const spendResult = await window.Digimon.spendForStockPicks();
    if (!spendResult.ok) {
      return {
        ok: false,
        message: spendResult.error || "Stock Picks를 열 수 없습니다.",
        detail: `보유 Digi-Mon: ${window.Digimon.format(spendResult.balance)}개`
      };
    }
    return { ok: true, balance: spendResult.balance };
  }

  function renderGate(container, message, detail) {
    container.innerHTML = `
      <article class="content-panel stock-panel stock-picks-gate">
        <h2>Stock Picks</h2>
        <p class="stock-picks-gate-message">${escapeHtml(message)}</p>
        ${detail ? `<p class="stock-picks-gate-detail">${escapeHtml(detail)}</p>` : ""}
        <p class="stock-picks-gate-hint">열람 Digi-Mon 1개 · ↺ 새로고침 1개 추가 · 잔액 0이면 다음날(한국 시간) 3개 충전</p>
      </article>
    `;
  }

  async function runStrategyLoad(root, strategy, market, options = {}) {
    const listEl = root.querySelector("#stock-picks-list");
    const statusEl = root.querySelector("#stock-picks-status");
    if (!listEl) return;

    if (!strategy?.load) {
      listEl.innerHTML = `<p class="stock-empty">이 추천 방식은 아직 준비 중입니다.</p>`;
      S.setStatus(statusEl, "", "");
      return;
    }

    await strategy.load({
      root,
      listEl,
      statusEl,
      market,
      forceRefresh: options.forceRefresh === true,
      fromTab: options.fromTab === true
    });
  }

  function renderMarketTabs(root, strategy, selectedMarket) {
    const marketSection = root.querySelector("#stock-picks-market-section");
    const marketTabs = root.querySelector("#stock-picks-market-tabs");
    const markets = strategy.markets || [];

    if (!markets.length) {
      if (marketSection) marketSection.hidden = true;
      return null;
    }

    if (marketSection) marketSection.hidden = false;
    const marketId =
      markets.find((m) => m.id === selectedMarket)?.id || strategy.defaultMarket || markets[0].id;

    marketTabs.innerHTML = markets
      .map(
        (m) =>
          `<button type="button" class="stock-tab stock-picks-tab${m.id === marketId ? " active" : ""}" data-market="${m.id}" role="tab">${escapeHtml(m.label)}</button>`
      )
      .join("");

    marketTabs.querySelectorAll(".stock-picks-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeMarket = btn.dataset.market;
        marketTabs.querySelectorAll(".stock-picks-tab").forEach((other) => {
          other.classList.toggle("active", other === btn);
        });
        const current = getStrategy(activeStrategyId);
        if (current) {
          void runStrategyLoad(root, current, activeMarket, { fromTab: true });
        }
      });
    });

    return marketId;
  }

  function selectStrategy(root, strategyId, options = {}) {
    const strategies = getStrategies();
    if (!strategies.length) {
      const listEl = root.querySelector("#stock-picks-list");
      if (listEl) {
        listEl.innerHTML = `<p class="stock-empty">등록된 추천 방식이 없습니다. picks/*.js 스크립트를 확인하세요.</p>`;
      }
      return;
    }

    if (options.strategyChanged && activeStrategyId) {
      const prev = getStrategy(activeStrategyId);
      prev?.destroy?.();
      window.DwStockPicksRenderer?.destroy?.();
    }

    const strategy = getStrategy(strategyId) || strategies[0];
    activeStrategyId = strategy.id;
    strategy.onActivate?.();

    root.querySelectorAll(".stock-picks-strategy-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.strategy === strategy.id);
    });

    const descEl = root.querySelector("#stock-picks-strategy-desc");
    if (descEl) descEl.textContent = strategy.description || "";

    const market =
      options.market ||
      renderMarketTabs(root, strategy, activeMarket) ||
      strategy.defaultMarket ||
      null;
    activeMarket = market;

    void runStrategyLoad(root, strategy, market, options);
  }

  function mountPage(container) {
    const strategies = getStrategies();

    container.innerHTML = `
      <article class="content-panel stock-panel">
        <div class="stock-header">
          <div>
            <h2>Stock Picks</h2>
            <p class="stock-intro">추천 방식을 선택한 뒤 결과를 확인하세요 · 열람 Digi-Mon 1개 · ↺ 새로고침 1개</p>
          </div>
          <button type="button" class="secondary-btn" id="stock-picks-refresh-btn" title="새로고침">Re</button>
        </div>

        <section class="stock-picks-strategy-section" aria-label="추천 방식">
          <p class="stock-picks-section-label">추천 방식</p>
          <div class="stock-tabs stock-picks-strategy-tabs" id="stock-picks-strategy-tabs" role="tablist"></div>
          <p id="stock-picks-strategy-desc" class="stock-picks-strategy-desc"></p>
        </section>

        <section class="stock-picks-market-section" id="stock-picks-market-section" aria-label="시장">
          <p class="stock-picks-section-label">시장</p>
          <div class="stock-tabs stock-picks-market-tabs" id="stock-picks-market-tabs" role="tablist"></div>
        </section>

        <p id="stock-picks-last-updated" class="stock-last-updated" hidden>마지막 업데이트: —</p>
        <p id="stock-picks-status" class="stock-status" hidden></p>

        <div class="stock-body stock-picks-results-section">
          <p class="stock-picks-section-label stock-picks-results-label">결과</p>
          <div id="stock-update-overlay" class="stock-update-overlay" hidden role="status" aria-live="polite">
            <span class="stock-update-spinner" aria-hidden="true"></span>
            <span id="stock-update-elapsed" class="stock-update-elapsed">0초</span>
            <span id="stock-update-message" class="stock-update-overlay-msg">실시간 분석 중… 잠시만 기다려 주세요. (최대 약 1분)</span>
          </div>
          <div id="stock-picks-list" class="stock-picks-list"></div>
        </div>

        <p class="stock-footnote">정기 스냅샷·분석 기반 참고용이며 투자 권유가 아닙니다. 실제 투자 결정은 본인 책임입니다.</p>
      </article>
    `;

    const root = container.querySelector(".stock-panel") || container;
    mountedRoot = root;

    const strategyTabsEl = root.querySelector("#stock-picks-strategy-tabs");
    strategyTabsEl.innerHTML = strategies
      .map(
        (s, i) =>
          `<button type="button" class="stock-tab stock-picks-strategy-tab${i === 0 ? " active" : ""}" data-strategy="${escapeHtml(s.id)}" role="tab">${escapeHtml(s.label)}</button>`
      )
      .join("");

    strategyTabsEl.querySelectorAll(".stock-picks-strategy-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.strategy === activeStrategyId) return;
        selectStrategy(root, btn.dataset.strategy, { strategyChanged: true });
      });
    });

    const introEl = root.querySelector(".stock-intro");
    if (introEl && S.isGuestMode()) {
      introEl.textContent =
        "Guest 모드 — 저장된 추천 데이터를 볼 수 있습니다. ↺ 새로고침·실시간 분석은 로그인 후 이용하세요.";
    }

    root.querySelector("#stock-picks-refresh-btn")?.addEventListener("click", async () => {
      const statusEl = root.querySelector("#stock-picks-status");
      const strategy = getStrategy(activeStrategyId);
      if (!strategy) return;

      if (S.isGuestMode()) {
        S.setStatus(statusEl, S.GUEST_REFRESH_MSG, "info");
        return;
      }

      const spendResult = await window.Digimon?.spendForStockPicksRefresh?.();
      if (!spendResult?.ok) {
        S.setStatus(statusEl, spendResult?.error || "Digi-Mon이 부족합니다.", "error");
        return;
      }

      await runStrategyLoad(root, strategy, activeMarket, { forceRefresh: true });
    });

    const initialId = readInitialStrategyId();
    selectStrategy(root, initialId || strategies[0]?.id);
    S.applyGuestRefreshControls(root);
  }

  async function renderPage(container) {
    if (!window.DwPickStrategies?.length) {
      container.innerHTML = `
        <article class="content-panel stock-panel">
          <h2>Stock Picks</h2>
          <p class="stock-status stock-status--error">Stock Picks 모듈을 불러오지 못했습니다. 페이지를 새로고침해 주세요.</p>
        </article>`;
      return;
    }

    container.innerHTML = `<p class="stock-loading">Stock Picks 접근 확인 중…</p>`;
    const access = await ensureStockPicksAccess();
    if (!access.ok) {
      renderGate(container, access.message, access.detail);
      return;
    }
    mountPage(container);
  }

  function destroy() {
    getStrategies().forEach((s) => s.destroy?.());
    window.DwStockPicksRenderer?.destroy?.();
    S.clearUpdateTimer(mountedRoot);
    mountedRoot = null;
    activeStrategyId = null;
    activeMarket = null;
  }

  window.DwStockPicks = {
    renderPage,
    destroy
  };
})();
