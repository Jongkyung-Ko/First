/**
 * Stock Picks 내부 전략 전환 — 단기/장기 그룹
 */
(function () {
  const SHORT_TERM_ITEMS = [
    { id: "stock-picks-formulas", label: "단기추천로직" },
    { id: "stock-picks", label: "감성뉴스" },
    { id: "recommend2", label: "바닥매집" },
    { id: "strategy-golden", label: "골든크로스" },
    { id: "strategy-bollinger", label: "볼린저밴드" },
    { id: "strategy-rsi", label: "RSI+다이버전스" },
    { id: "strategy-candle-support", label: "지지+반전캔들" },
    { id: "strategy-obv", label: "OBV+다이버전스" },
    { id: "strategy-bottom", label: "쌍·삼중바닥" },
    { id: "strategy-vcp", label: "VCP" }
  ];

  const LONG_TERM_ITEMS = [
    { id: "long-term-screens", label: "장기추천로직" },
    { id: "quality-score", label: "재무종합" },
    { id: "fundamentals-per", label: "PER" },
    { id: "fundamentals-roe", label: "ROE" },
    { id: "fundamentals-pbr", label: "PBR" },
    { id: "fundamentals-dividend", label: "배당" },
    { id: "long-term-small-cap-pbr", label: "소형·저PBR" },
    { id: "long-term-magic-formula", label: "마법공식" },
    { id: "long-term-f-score", label: "F-스코어" }
  ];

  const ITEMS = [...SHORT_TERM_ITEMS, ...LONG_TERM_ITEMS];
  const STRATEGY_PAGE_IDS = new Set(ITEMS.map((i) => i.id));

  function renderButton(item, activePage) {
    const active = item.id === activePage;
    const hub = item.id === "stock-picks-formulas" || item.id === "long-term-screens" || item.id === "quality-score";
    return `
        <button
          type="button"
          class="stock-strategy-nav-btn${active ? " active" : ""}${hub ? " stock-strategy-nav-btn--hub" : ""}"
          data-page="${item.id}"
          aria-current="${active ? "page" : "false"}"
        ><span class="stock-nav-label">${item.label}</span></button>`;
  }

  function renderGroup(items, activePage, groupClass) {
    return `
      <div class="stock-strategy-nav-group ${groupClass}">
        <div class="stock-strategy-nav-tabs">${items.map((item) => renderButton(item, activePage)).join("")}</div>
      </div>`;
  }

  function renderHtml(activePage) {
    return `
      <nav class="stock-strategy-nav" aria-label="Stock Picks 전략">
        <p class="stock-strategy-nav-disclaimer" role="note">
          <strong class="stock-strategy-nav-disclaimer-mark">주의</strong> · 추천 로직은 참고용이며 투자 손실에 대한 책임을 지지 않습니다.<br />
          모든 매매는 본인의 판단과 책임입니다.
        </p>
        <div class="stock-strategy-nav-rows">
          ${renderGroup(SHORT_TERM_ITEMS, activePage, "stock-strategy-nav-group--short")}
          ${renderGroup(LONG_TERM_ITEMS, activePage, "stock-strategy-nav-group--long")}
        </div>
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
    return nav;
  }

  function isStockPicksStrategyPage(pageId) {
    return STRATEGY_PAGE_IDS.has(pageId);
  }

  window.StockStrategyNav = {
    ITEMS,
    SHORT_TERM_ITEMS,
    LONG_TERM_ITEMS,
    STRATEGY_PAGE_IDS,
    renderHtml,
    mount,
    bindNav,
    isStockPicksStrategyPage
  };
})();
