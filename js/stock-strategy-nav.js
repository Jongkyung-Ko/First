/**
 * Stock Picks 내부 전략 전환
 */
(function () {
  const ITEMS = [
    { id: "stock-picks-formulas", label: "추천공식" },
    { id: "stock-picks", label: "감성뉴스" },
    { id: "recommend2", label: "바닥매집" },
    { id: "strategy-golden", label: "골든크로스" },
    { id: "strategy-bollinger", label: "볼린저밴드" },
    { id: "strategy-rsi", label: "RSI+다이버전스" },
    { id: "strategy-candle-support", label: "지지+반전캔들" },
    { id: "strategy-obv", label: "OBV+다이버전스" },
    { id: "strategy-bottom", label: "쌍·삼중바닥" },
    { id: "strategy-vcp", label: "VCP" },
    { id: "long-term-screens", label: "장기추천로직" },
    { id: "fundamentals-per", label: "PER" },
    { id: "fundamentals-roe", label: "ROE" },
    { id: "fundamentals-pbr", label: "PBR" },
    { id: "fundamentals-dividend", label: "배당" }
  ];

  const STRATEGY_PAGE_IDS = new Set(ITEMS.map((i) => i.id));

  function renderHtml(activePage) {
    const buttons = ITEMS.map((item) => {
      const active = item.id === activePage;
      return `
        <button
          type="button"
          class="stock-strategy-nav-btn${active ? " active" : ""}"
          data-page="${item.id}"
          aria-current="${active ? "page" : "false"}"
        ><span class="stock-nav-label">${item.label}</span><span class="stock-nav-updated-at stock-nav-updated-at--empty" aria-label="갱신 일시 없음">-</span></button>`;
    }).join("");

    return `
      <nav class="stock-strategy-nav" aria-label="Stock Picks 전략">
        <div class="stock-strategy-nav-tabs">${buttons}</div>
      </nav>`;
  }

  function bindNav(root, activePage) {
    if (!root) return;
    root.querySelectorAll(".stock-strategy-nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = btn.dataset.page;
        if (!page || page === activePage) return;
        if (window.AppNavigation?.navigate) {
          window.AppNavigation.navigate({ page });
        } else {
          const base = location.pathname.indexOf("/First") !== -1 ? "/First/" : "/";
          location.href = `${base}?page=${encodeURIComponent(page)}`;
        }
      });
    });
  }

  function mount(parent, activePage) {
    if (!parent) return null;
    const existing = parent.querySelector(".stock-strategy-nav");
    if (existing) existing.remove();

    const wrap = document.createElement("div");
    wrap.innerHTML = renderHtml(activePage);
    const nav = wrap.firstElementChild;
    parent.insertBefore(nav, parent.firstChild);
    bindNav(nav, activePage);
    window.StockScanLock?.refreshMeta?.();
    return nav;
  }

  function isStockPicksStrategyPage(pageId) {
    return STRATEGY_PAGE_IDS.has(pageId);
  }

  window.StockStrategyNav = {
    ITEMS,
    STRATEGY_PAGE_IDS,
    renderHtml,
    mount,
    bindNav,
    isStockPicksStrategyPage
  };
})();
