/**
 * 장기 추천 로직 — 설명 + 3전략 결과 + 최근 100건 이력
 */
(function () {
  const PAGE_ID = "long-term-screens";
  const NY_TZ = "America/New_York";
  const MARKET_TABS = [
    { key: "kospi", label: "KOSPI" },
    { key: "kosdaq", label: "KOSDAQ" },
    { key: "nasdaq", label: "NASDAQ" },
    { key: "nyse", label: "NYSE" }
  ];
  const STRATEGY_TABS = [
    { id: "small-cap-pbr", label: "소형·저PBR" },
    { id: "magic-formula", label: "마법공식" },
    { id: "f-score", label: "F-스코어" }
  ];

  let abortController = null;
  let cachedPayload = null;
  let activeStrategy = "small-cap-pbr";
  let activeMarket = "kospi";
  let accessGranted = false;

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

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
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

  function stockLink(ticker) {
    const kr = String(ticker || "").match(/^(\d{6})\.(KS|KQ)$/i);
    if (kr) return `https://finance.naver.com/item/main.naver?code=${kr[1]}`;
    const sym = String(ticker || "").replace(/\.(KS|KQ)$/i, "");
    if (/^[A-Z][A-Z0-9.\-]{0,9}$/i.test(sym)) {
      return `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}`;
    }
    return null;
  }

  function renderGuideBlock(title, summary, rules, patterns) {
    const rulesHtml = (rules || []).map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    const patternsHtml = (patterns || [])
      .map(
        (p) =>
          `<div class="recommend2-pattern-card"><strong>${escapeHtml(p.label)}</strong><p>${escapeHtml(p.description)}</p></div>`
      )
      .join("");
    return `
      <section class="long-term-guide-block">
        <h3 class="long-term-guide-title">${escapeHtml(title)}</h3>
        <p class="long-term-guide-summary">${escapeHtml(summary || "")}</p>
        ${rulesHtml ? `<ol class="recommend2-strategy-rules">${rulesHtml}</ol>` : ""}
        ${patternsHtml ? `<div class="recommend2-pattern-grid">${patternsHtml}</div>` : ""}
      </section>`;
  }

  function renderGuides(payload) {
    const meta = payload?.strategy || {};
    const fund = meta.fundamentalsGuide || {};
    const strategies = meta.strategies || [];

    let html = `
      <details class="recommend2-strategy-details long-term-guides" open>
        <summary class="recommend2-strategy-summary-toggle">지표·로직 설명 (PER · ROE · PBR · 배당 + 장기 3전략)</summary>
        <div class="long-term-guides-inner">
          <p class="long-term-intro">${escapeHtml(meta.summary || "")}</p>
          ${renderGuideBlock(
            fund.title || "가치·배당 지표",
            fund.summary,
            fund.rules,
            fund.patterns
          )}`;

    strategies.forEach((s) => {
      html += renderGuideBlock(s.label, s.summary, s.rules, null);
    });

    html += `<p class="recommend2-disclaimer">${escapeHtml(meta.disclaimer || "")}</p></div></details>`;
    return html;
  }

  function renderPickRow(item) {
    const currency = item.currency || "USD";
    const link = stockLink(item.ticker);
    const nameHtml = link
      ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.name)}</a>`
      : escapeHtml(item.name);
    return `
      <tr>
        <td class="fundamentals-rank">${item.rank ?? "—"}</td>
        <td>${nameHtml}<span class="recommend2-card-ticker">${escapeHtml(item.ticker)}</span></td>
        <td>${formatPrice(item.price, currency)}</td>
        <td class="fundamentals-metric"><strong>${escapeHtml(item.metricDisplay || "—")}</strong></td>
      </tr>`;
  }

  function renderPicksTable(picks, label) {
    if (!picks?.length) {
      return `<p class="recommend2-empty">${escapeHtml(label)} 추천이 아직 없습니다. 청크 스캔이 진행 중일 수 있습니다.</p>`;
    }
    return `
      <div class="fundamentals-table-wrap">
        <table class="recommend2-match-table fundamentals-table">
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col">종목</th>
              <th scope="col">주가</th>
              <th scope="col">추천 수치</th>
            </tr>
          </thead>
          <tbody>${picks.map(renderPickRow).join("")}</tbody>
        </table>
      </div>`;
  }

  function renderHistoryTable(history) {
    const rows = history || [];
    if (!rows.length) {
      return `<p class="recommend2-empty">누적 추천 이력이 없습니다. 시장별 스캔 완료 후 자동 기록됩니다.</p>`;
    }
    return `
      <div class="fundamentals-table-wrap long-term-history-wrap">
        <table class="recommend2-match-table fundamentals-table long-term-history-table">
          <thead>
            <tr>
              <th scope="col">추천일</th>
              <th scope="col">로직</th>
              <th scope="col">종목</th>
              <th scope="col">종목가격</th>
              <th scope="col">추천 수치</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => {
                const currency = /\.(KS|KQ)$/i.test(row.ticker || "") ? "KRW" : "USD";
                const link = stockLink(row.ticker);
                const nameHtml = link
                  ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.name || row.ticker)}</a>`
                  : escapeHtml(row.name || row.ticker);
                return `
              <tr>
                <td>${formatDate(row.recommendedAt)}</td>
                <td>${escapeHtml(row.strategyLabel || row.strategyId || "—")}</td>
                <td>${nameHtml}<span class="recommend2-card-ticker">${escapeHtml(row.ticker || "")}</span></td>
                <td>${formatPrice(row.price, currency)}</td>
                <td class="fundamentals-metric">${escapeHtml(row.metricValue || "—")}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
        <p class="long-term-history-note">최근 ${rows.length}건 (최대 100건 유지)</p>
      </div>`;
  }

  function renderScanProgress(payload) {
    const cursor = payload?.scanCursor || {};
    const strat = payload?.strategies?.[activeStrategy];
    const market = strat?.markets?.[activeMarket] || {};
    const offset = market.offset || 0;
    const universe = strat?.meta?.universeLimit || "—";
    const complete = market.complete ? "완료" : `진행 ${offset}/${universe}`;
    return `
      <p class="long-term-scan-status">
        청크 스캔: <strong>${escapeHtml(STRATEGY_TABS.find((t) => t.id === activeStrategy)?.label || activeStrategy)}</strong>
        · ${escapeHtml(activeMarket.toUpperCase())} ${escapeHtml(complete)}
        · 다음: ${escapeHtml(cursor.strategyId || "—")} / ${escapeHtml(cursor.market || "—")} offset ${cursor.offset ?? 0}
      </p>`;
  }

  function updateView(root, payload) {
    cachedPayload = payload;
    const guidesEl = root.querySelector("#long-term-guides");
    if (guidesEl) guidesEl.innerHTML = renderGuides(payload);

    const updatedEl = root.querySelector("#long-term-updated");
    if (updatedEl) {
      updatedEl.innerHTML = `마지막 청크 갱신 <span class="stock-picks-updated-at">${escapeHtml(formatUpdatedNy(payload.lastChunkAt || payload.updatedAt))}</span> · 자동 청크 스캔(6시간 간격) · Push 알림 제외`;
    }

    const progressEl = root.querySelector("#long-term-progress");
    if (progressEl) progressEl.innerHTML = renderScanProgress(payload);

    const picks =
      payload?.strategies?.[activeStrategy]?.markets?.[activeMarket]?.picks || [];
    const listEl = root.querySelector("#long-term-picks");
    if (listEl) {
      listEl.innerHTML = renderPicksTable(
        picks,
        STRATEGY_TABS.find((t) => t.id === activeStrategy)?.label || ""
      );
    }

    const histEl = root.querySelector("#long-term-history");
    if (histEl) histEl.innerHTML = renderHistoryTable(payload.history || []);
  }

  async function loadData(root) {
    const listEl = root.querySelector("#long-term-picks");
    if (!cachedPayload) {
      listEl.innerHTML = `<p class="recommend2-loading">데이터를 불러오는 중…</p>`;
    }
    if (abortController) abortController.abort();
    abortController = new AbortController();
    try {
      const payload = await window.LongTermData.load({
        signal: abortController.signal,
        preferCache: true
      });
      updateView(root, payload);
    } catch (err) {
      if (err.name === "AbortError") return;
      if (!cachedPayload) {
        listEl.innerHTML = `<p class="recommend2-empty">불러오지 못했습니다. (${escapeHtml(err.message)})</p>`;
      }
    }
  }

  function renderGate(container, message, detail) {
    container.innerHTML = `
      <article class="content-panel stock-panel stock-picks-gate recommend2-panel">
        <h2>Stock Picks · 장기추천로직</h2>
        <p class="stock-picks-gate-message">${escapeHtml(message)}</p>
        ${detail ? `<p class="stock-picks-gate-detail">${escapeHtml(detail)}</p>` : ""}
        <p class="stock-picks-gate-hint">열람 Digi-Mon 1개 · 자동 청크 스캔 (Re 없음)</p>
      </article>`;
    window.StockStrategyNav?.mount?.(container.querySelector(".stock-panel"), PAGE_ID);
  }

  async function ensureAccess() {
    const fn = window.Digimon?.spendForStockStrategy;
    if (!fn) {
      return { ok: false, message: "Digi-Mon 모듈을 불러오지 못했습니다.", detail: null };
    }
    const spendResult = await fn("long-term-screens", "장기추천");
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
    cachedPayload = window.LongTermData.readCache() || null;

    container.innerHTML = `
      <article class="content-panel recommend2-panel long-term-panel">
        <header class="recommend2-header">
          <div>
            <h2>Stock Picks · 장기추천로직</h2>
            <p class="recommend2-intro">장기 투자 관점 가치·재무 스크리닝 — 청크 분할 자동 스캔 · 최근 100건 이력 누적</p>
          </div>
        </header>
        <div id="long-term-guides"></div>
        <p id="long-term-updated" class="recommend2-updated"></p>
        <p id="long-term-progress" class="long-term-scan-status"></p>
        <section class="recommend2-filters" aria-label="전략 선택">
          <p class="recommend2-section-label">장기 전략</p>
          <div class="stock-tabs recommend2-tabs" role="tablist" id="long-term-strategy-tabs">
            ${STRATEGY_TABS.map(
              (t) =>
                `<button type="button" class="stock-tab recommend2-tab long-term-strategy-tab${
                  activeStrategy === t.id ? " active" : ""
                }" data-strategy="${escapeHtml(t.id)}">${escapeHtml(t.label)}</button>`
            ).join("")}
          </div>
        </section>
        <section class="recommend2-filters" aria-label="시장 선택">
          <p class="recommend2-section-label">시장</p>
          <div class="stock-tabs recommend2-tabs" role="tablist">
            ${MARKET_TABS.map(
              (t) =>
                `<button type="button" class="stock-tab recommend2-tab long-term-market-tab${
                  activeMarket === t.key ? " active" : ""
                }" data-market="${escapeHtml(t.key)}">${escapeHtml(t.label)}</button>`
            ).join("")}
          </div>
        </section>
        <div id="long-term-picks" class="fundamentals-list-wrap"></div>
        <section class="long-term-history-section">
          <h3 class="long-term-history-heading">장기 추천 누적 (최근 100건)</h3>
          <div id="long-term-history"></div>
        </section>
      </article>`;

    const root = container.querySelector(".long-term-panel") || container;
    window.StockStrategyNav?.mount?.(root, PAGE_ID);

    root.querySelectorAll(".long-term-strategy-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeStrategy = btn.dataset.strategy || "small-cap-pbr";
        root.querySelectorAll(".long-term-strategy-tab").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        if (cachedPayload) updateView(root, cachedPayload);
      });
    });

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

  window.LongTermScreens = { renderPage, leavePage, destroy };
})();
