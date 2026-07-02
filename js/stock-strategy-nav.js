/**
 * Stock Picks 내부 전략 전환 + 통합 Re
 */
(function () {
  const ITEMS = [
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

  const STRATEGY_PAGE_IDS = new Set(ITEMS.map((i) => i.id));

  let batchAbort = null;
  let batchStatusEl = null;

  function renderHtml(activePage) {
    const buttons = ITEMS.map((item) => {
      const active = item.id === activePage;
      return `
        <button
          type="button"
          class="stock-strategy-nav-btn${active ? " active" : ""}"
          data-page="${item.id}"
          aria-current="${active ? "page" : "false"}"
        >${item.label}</button>`;
    }).join("");

    return `
      <nav class="stock-strategy-nav" aria-label="Stock Picks 전략">
        <div class="stock-strategy-nav-inner">
          <div class="stock-strategy-nav-tabs">${buttons}</div>
          <button
            type="button"
            class="secondary-btn stock-strategy-nav-re"
            id="stock-picks-batch-re"
            title="바닥매집·전략 전체 통합 스캔 (TOP 100 · DM 1)"
          >Re</button>
        </div>
        <p id="stock-picks-batch-status" class="stock-picks-batch-status" hidden></p>
      </nav>`;
  }

  function setBatchStatus(text, kind) {
    if (!batchStatusEl) return;
    if (!text) {
      batchStatusEl.hidden = true;
      batchStatusEl.textContent = "";
      batchStatusEl.className = "stock-picks-batch-status";
      return;
    }
    batchStatusEl.hidden = false;
    batchStatusEl.textContent = text;
    batchStatusEl.className = `stock-picks-batch-status${kind === "error" ? " error" : kind === "info" ? " info" : ""}`;
  }

  function bindBatchRe() {
    const btn = document.getElementById("stock-picks-batch-re");
    if (!btn || btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", async () => {
      const Batch = window.StockPicksBatch;
      if (!Batch?.runBatch) {
        setBatchStatus("통합 스캔 모듈을 불러오지 못했습니다.", "error");
        return;
      }
      if (batchAbort) batchAbort.abort();
      batchAbort = new AbortController();
      btn.disabled = true;
      try {
        await Batch.runBatch({
          signal: batchAbort.signal,
          onProgress: (p) => {
            setBatchStatus(
              `통합 스캔 (${p.step}/${p.total}) · ${p.label} TOP 100…`,
              "info"
            );
          }
        });
        setBatchStatus("통합 스캔 완료 · 바닥매집·전략 전체 갱신됨", null);
      } catch (err) {
        if (err.name === "AbortError") return;
        setBatchStatus(err.message || String(err), "error");
      } finally {
        btn.disabled = false;
        batchAbort = null;
      }
    });
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
    batchStatusEl = root.querySelector("#stock-picks-batch-status");
    bindBatchRe();
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
    STRATEGY_PAGE_IDS,
    renderHtml,
    mount,
    bindNav,
    isStockPicksStrategyPage,
    setBatchStatus
  };
})();
