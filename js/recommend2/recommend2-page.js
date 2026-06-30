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

  function formatPrice(value) {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
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

  function naverLink(ticker) {
    const m = String(ticker || "").match(/^(\d{6})\.KS$/i);
    if (m) return `https://finance.naver.com/item/main.naver?code=${m[1]}`;
    return null;
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

  function filterSignals(payload, filter) {
    const active = payload?.activeSignals || [];
    const recent = payload?.recentSignals || [];
    if (filter === "active") return active;
    if (filter === "recent") return recent;
    if (filter === "A") return recent.filter((s) => s.pattern === "A");
    if (filter === "B") return recent.filter((s) => s.pattern === "B");
    return recent;
  }

  function renderSignalCard(sig) {
    const upCls = sig.up ? "up" : "down";
    const upLabel = sig.up ? "상승" : "하락";
    const link = naverLink(sig.ticker);
    const nameHtml = link
      ? `<a href="${link}" target="_blank" rel="noopener noreferrer" class="recommend2-card-name">${escapeHtml(sig.name)}</a>`
      : `<span class="recommend2-card-name">${escapeHtml(sig.name)}</span>`;

    return `
      <article class="recommend2-card recommend2-card--${sig.pattern}">
        <div class="recommend2-card-header">
          <span class="recommend2-card-pattern">${escapeHtml(sig.patternLabel || sig.pattern)}</span>
          ${nameHtml}
          <span class="recommend2-card-ticker">${escapeHtml(sig.ticker)}</span>
        </div>
        <div class="recommend2-card-metrics">
          <span>매집신호일 <strong>${escapeHtml(sig.signalDate || "—")}</strong></span>
          <span>종가 ${formatPrice(sig.close)}</span>
          <span class="${upCls}">당일 ${formatPct(sig.closePct)} (${upLabel})</span>
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
    if (!items.length) {
      const emptyMsg =
        filter === "active"
          ? "최근 거래일 기준 매집 신호 종목이 없습니다."
          : "해당 조건의 신호가 없습니다.";
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

  function updateView(root, payload) {
    cachedPayload = payload;
    const strategyEl = root.querySelector("#recommend2-strategy-mount");
    if (strategyEl && payload?.strategy) {
      strategyEl.innerHTML = renderStrategyBox(payload.strategy);
    }
    const updatedEl = root.querySelector("#recommend2-updated");
    if (updatedEl) {
      updatedEl.textContent = `데이터 기준: ${formatUpdated(payload.updatedAt)}`;
      if (payload.latestSignalDate) {
        updatedEl.textContent += ` · 최신 신호일 ${payload.latestSignalDate}`;
      }
    }
    const listEl = root.querySelector("#recommend2-list");
    const statusEl = root.querySelector("#recommend2-status");
    const items = filterSignals(payload, activeFilter);
    renderList(listEl, payload, activeFilter);
    setStatus(
      statusEl,
      `${items.length}건 · TOP50 ${payload.universeSize || 50}종목 스캔`,
      "info"
    );
  }

  async function loadData(root, options = {}) {
    const listEl = root.querySelector("#recommend2-list");
    const statusEl = root.querySelector("#recommend2-status");
    const forceLive = options.forceLive === true;

    if (!forceLive && cachedPayload) {
      updateView(root, cachedPayload);
      return;
    }

    listEl.innerHTML = `<p class="recommend2-loading">바닥매집 신호를 분석하는 중…</p>`;
    setStatus(statusEl, forceLive ? "실시간 스캔 중… (최대 수 분)" : "스냅샷 불러오는 중…", "info");

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
            <p class="recommend2-intro">KOSPI TOP 50 · 바닥매집 전략 · DM 소모 없이 열람</p>
          </div>
          <button type="button" class="secondary-btn" id="recommend2-refresh-btn" title="실시간 스캔">Re</button>
        </header>

        <div id="recommend2-strategy-mount"></div>

        <section class="recommend2-filters" aria-label="신호 필터">
          <p class="recommend2-section-label">신호 목록</p>
          <div class="stock-tabs recommend2-tabs" role="tablist">
            <button type="button" class="stock-tab recommend2-tab active" data-filter="active" role="tab">최신 매집</button>
            <button type="button" class="stock-tab recommend2-tab" data-filter="recent" role="tab">최근 2주</button>
            <button type="button" class="stock-tab recommend2-tab" data-filter="A" role="tab">패턴 A</button>
            <button type="button" class="stock-tab recommend2-tab" data-filter="B" role="tab">패턴 B</button>
          </div>
        </section>

        <p id="recommend2-updated" class="recommend2-updated"></p>
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
    cachedPayload = null;
  }

  window.Recommend2 = {
    renderPage: mountPage,
    destroy,
    leavePage: destroy
  };
})();
