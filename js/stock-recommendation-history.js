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

  function computeReturnPct(recPrice, currentClose) {
    try {
      if (recPrice == null || currentClose == null) return null;
      const base = Number(recPrice);
      const now = Number(currentClose);
      if (!Number.isFinite(base) || !Number.isFinite(now) || base <= 0) return null;
      return Math.round(((now - base) / base) * 10000) / 100;
    } catch (_e) {
      return null;
    }
  }

  /** 동일 종목: 최초 추천일·당시 주가 유지, repeatCount 합산 */
  function mergeHistoryByFirstRecommendation(rows) {
    const grouped = new Map();
    for (const row of rows || []) {
      const key = String(row.ticker || "").trim();
      if (!key) continue;
      const list = grouped.get(key) || [];
      list.push(row);
      grouped.set(key, list);
    }
    const merged = [];
    grouped.forEach((list) => {
      list.sort(
        (a, b) =>
          (Date.parse(a.recommendedAt || 0) || 0) - (Date.parse(b.recommendedAt || 0) || 0)
      );
      const first = list[0];
      let repeatCount = 0;
      for (const row of list) {
        repeatCount += Number(row.repeatCount) > 0 ? Number(row.repeatCount) : 1;
      }
      const latest = list[list.length - 1];
      const currentClose = latest.currentClose ?? first.currentClose;
      const price = first.price;
      merged.push({
        ...first,
        price,
        recommendedAt: first.recommendedAt,
        repeatCount,
        currentClose,
        returnPct: computeReturnPct(price, currentClose),
        metricValue: latest.metricValue ?? first.metricValue
      });
    });
    merged.sort(
      (a, b) =>
        (Date.parse(a.recommendedAt || 0) || 0) - (Date.parse(b.recommendedAt || 0) || 0)
    );
    return merged;
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

  function renderHistoryTable(
    history,
    {
      strategyId = null,
      summary = null,
      dedupeByTicker = false,
      nameOnlyWhite = false,
      countColumnLabel = "순위"
    } = {}
  ) {
    let rows = history || [];
    if (strategyId) {
      rows = rows.filter((row) => row.strategyId === strategyId);
    }
    if (dedupeByTicker) {
      rows = mergeHistoryByFirstRecommendation(rows);
    } else {
      rows = [...rows].sort(
        (a, b) =>
          (Date.parse(a.recommendedAt || 0) || 0) - (Date.parse(b.recommendedAt || 0) || 0)
      );
    }
    const stats = summary && strategyId == null ? summary : computeSummary(rows);

    if (!rows.length) {
      const emptyMsg = strategyId
        ? "추천 이력이 없습니다. 스캔·갱신 완료 후 자동 기록됩니다."
        : "추천 이력이 없습니다.";
      return `<p class="recommend2-empty">${escapeHtml(emptyMsg)}</p>`;
    }

    const firstColLabel = dedupeByTicker ? "횟수" : countColumnLabel;
    const noteText = dedupeByTicker
      ? `종목 ${rows.length}개 (최대 100종목) · 최초 추천일·당시 주가 기준 · 현시점 종가·수익률은 조회 시점 Yahoo 기준`
      : `최근 ${rows.length}건 (최대 100건 유지) · 현시점 종가·수익률은 조회 시점 Yahoo 기준`;

    return `
      ${renderSummaryBar(stats)}
      <div class="fundamentals-table-wrap long-term-history-wrap stock-rec-history-wrap">
        <table class="recommend2-match-table fundamentals-table long-term-history-table stock-rec-history-table${
          nameOnlyWhite ? " stock-rec-history-table--name-white" : ""
        }">
          <thead>
            <tr>
              <th scope="col">${escapeHtml(firstColLabel)}</th>
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
                const countVal = dedupeByTicker
                  ? row.repeatCount || 1
                  : row.rank ?? idx + 1;
                const nameHtml = nameOnlyWhite
                  ? `<span class="stock-rec-history-name-text">${escapeHtml(row.name || "—")}</span>`
                  : (() => {
                      const link = stockLink(row.ticker);
                      if (link) {
                        return `<a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.name || row.ticker)}</a>`;
                      }
                      return escapeHtml(row.name || row.ticker);
                    })();
                const tickerSuffix =
                  nameOnlyWhite || dedupeByTicker
                    ? ""
                    : `<span class="recommend2-card-ticker">${escapeHtml(row.ticker || "")}</span>`;
                const ret = row.returnPct;
                return `
              <tr>
                <td class="fundamentals-rank">${escapeHtml(String(countVal))}</td>
                <td>${formatDateYmd(row.recommendedAt)}</td>
                <td class="stock-rec-history-name">${nameHtml}${tickerSuffix}</td>
                <td>${formatPrice(row.price, currency)}</td>
                <td class="fundamentals-metric">${escapeHtml(row.metricValue || "—")}</td>
                <td>${formatPrice(row.currentClose, currency)}</td>
                <td class="fundamentals-metric stock-rec-return${returnClass(ret)}"><strong>${escapeHtml(formatReturnPct(ret))}</strong></td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
        <p class="long-term-history-note">${escapeHtml(noteText)}</p>
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
    returnClass,
    computeReturnPct,
    mergeHistoryByFirstRecommendation,
    computeSummary,
    renderSummaryBar,
    renderHistoryTable,
    historySectionHtml
  };
})();
