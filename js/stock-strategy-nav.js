/**
 * Stock Picks ↔ 추천2 상단 전환 (같은 주식 추천 영역)
 */
(function () {
  const ITEMS = [
    { id: "stock-picks", label: "Stock Picks", sub: "뉴스 감성" },
    { id: "recommend2", label: "추천2", sub: "바닥매집" }
  ];

  function renderHtml(activePage) {
    const buttons = ITEMS.map((item) => {
      const active = item.id === activePage;
      return `
        <button
          type="button"
          class="stock-strategy-nav-btn${active ? " active" : ""}"
          data-page="${item.id}"
          aria-current="${active ? "page" : "false"}"
        >
          <span class="stock-strategy-nav-label">${item.label}</span>
          <span class="stock-strategy-nav-sub">${item.sub}</span>
        </button>`;
    }).join("");

    return `<nav class="stock-strategy-nav" aria-label="주식 추천 방식">${buttons}</nav>`;
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
    bindNav(parent, activePage);
    return nav;
  }

  window.StockStrategyNav = {
    renderHtml,
    mount,
    bindNav
  };
})();
