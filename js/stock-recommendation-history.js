/**
 * 추천 이력 100건 테이블 — 순위·수익률·상승/하락 집계
 */
(function () {
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

  function formatDateYmd(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  }

  function formatReturnPct(value) {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    const n = Number(value);
    const sign = n > 0 ? "+" : "";
    return `${sign}${n.toFixed(2)}%`;
  }

  function returnClass(value) {
    if (value == null || !Number.isFinite(Number(value))) return "";
    const n = Number(value);
    if (n > 0) return " stock-rec-return--up";
    if (n < 0) return " stock-rec-return--down";
    return "";
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

  function computeSummary(rows) {
    const valid = (rows || []).filter((r) => r.returnPct != null && Number.isFinite(Number(r.returnPct)));
    const up = valid.filter((r) => Number(r.returnPct) > 0).length;
    const down = valid.filter((r) => Number(r.returnPct) < 0).length;
    const total = valid.length;
    const matchRatePct = total ? Math.round((up / total) * 1000) / 10 : null;
    const avgReturnPct = total
      ? Math.round((valid.reduce((s, r) => s + Number(r.returnPct), 0) / total) * 100) / 100
      : null;
    return { up, down, flat: total - up - down, total, matchRatePct, avgReturnPct };
  }

  function renderSummaryBar(summary) {
    const s = summary || { up: 0, down: 0, total: 0, matchRatePct: null, avgReturnPct: null };
    const matchText =
      s.matchRatePct != null ? `${escapeHtml(String(s.matchRatePct))}%` : "—";
    const avgText =
      s.avgReturnPct != null ? formatReturnPct(s.avgReturnPct) : "—";
    const avgCls = returnClass(s.avgReturnPct);
    return `
      <p class="stock-rec-history-summary">
        <span>상승: <strong class="stock-rec-return--up">${s.up ?? 0}건</strong></span>
        <span>하락: <strong class="stock-rec-return--down">${s.down ?? 0}건</strong></span>
        <span>일치율: <strong>${matchText}</strong> <span class="stock-rec-summary-hint">(상승 ${s.up ?? 0}/${s.total ?? 0})</span></span>
        <span>수익률: <strong class="stock-rec-return${avgCls}">${escapeHtml(avgText)}</strong> <span class="stock-rec-summary-hint">(평균)</span></span>
      </p>`;
  }

  function renderHistoryTable(history, { strategyId = null, summary = null } = {}) {
    let rows = history || [];
    if (strategyId) {
      rows = rows.filter((row) => row.strategyId === strategyId);
    }
    const stats = summary && strategyId == null ? summary : computeSummary(rows);

    if (!rows.length) {
      const emptyMsg = strategyId
        ? "추천 이력이 없습니다. 스캔·갱신 완료 후 자동 기록됩니다."
        : "추천 이력이 없습니다.";
      return `<p class="recommend2-empty">${escapeHtml(emptyMsg)}</p>`;
    }

    return `
      ${renderSummaryBar(stats)}
      <div class="fundamentals-table-wrap long-term-history-wrap stock-rec-history-wrap">
        <table class="recommend2-match-table fundamentals-table long-term-history-table stock-rec-history-table">
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col">날짜</th>
              <th scope="col">종목</th>
              <th scope="col">주가</th>
              <th scope="col">계산 수치</th>
              <th scope="col">현시점 종가</th>
              <th scope="col">수익률</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row, idx) => {
                const currency = /\.(KS|KQ)$/i.test(row.ticker || "") ? "KRW" : "USD";
                const link = stockLink(row.ticker);
                const nameHtml = link
                  ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.name || row.ticker)}</a>`
                  : escapeHtml(row.name || row.ticker);
                const rank = row.rank ?? idx + 1;
                const ret = row.returnPct;
                return `
              <tr>
                <td class="fundamentals-rank">${escapeHtml(String(rank))}</td>
                <td>${formatDateYmd(row.recommendedAt)}</td>
                <td>${nameHtml}<span class="recommend2-card-ticker">${escapeHtml(row.ticker || "")}</span></td>
                <td>${formatPrice(row.price, currency)}</td>
                <td class="fundamentals-metric">${escapeHtml(row.metricValue || "—")}</td>
                <td>${formatPrice(row.currentClose, currency)}</td>
                <td class="fundamentals-metric stock-rec-return${returnClass(ret)}"><strong>${escapeHtml(formatReturnPct(ret))}</strong></td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
        <p class="long-term-history-note">최근 ${rows.length}건 (최대 100건 유지) · 현시점 종가·수익률은 조회 시점 Yahoo 기준</p>
      </div>`;
  }

  function historySectionHtml(title) {
    const heading = title || "추천 이력 (최근 100건)";
    return `
      <section class="long-term-history-section stock-rec-history-section">
        <h3 class="long-term-history-heading">${escapeHtml(heading)}</h3>
        <div class="long-term-history-mount stock-rec-history-mount"></div>
      </section>`;
  }

  window.StockRecommendationHistory = {
    escapeHtml,
    formatPrice,
    formatDateYmd,
    formatReturnPct,
    computeSummary,
    renderSummaryBar,
    renderHistoryTable,
    historySectionHtml
  };
})();
