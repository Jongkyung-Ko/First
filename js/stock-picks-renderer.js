/**
 * Stock Picks — 카드 렌더링·차트·뉴스·정확도 패널
 */
(function () {
  const S = window.DwStockPicksShared;
  if (!S) {
    console.warn("DwStockPicksRenderer: DwStockPicksShared not loaded");
    return;
  }

  const {
    escapeHtml,
    getApiBase,
    formatFetchError,
    warmApi,
    fetchJsonWithRetry,
    formatTime,
    formatPct,
    formatPrice,
    marketLabel,
    headlineThumbHtml
  } = S;

  const pickChartState = new WeakMap();
  const pickChartDataCache = new Map();
  let picksAccuracySummary = null;
  let headlinesAbortController = null;
  let activeListEl = null;

  function pickStanceClass(stance) {
    if (stance === "recommend") return "recommend";
    if (stance === "caution") return "caution";
    return "watch";
  }

  function pickScoreAppearance(score) {
    const value = Number(score);
    if (!Number.isFinite(value) || value === 0) {
      return { className: "stock-pick-card--score-neutral", styleAttr: "" };
    }

    const intensity = Math.min(1, Math.abs(value) / 12);
    const alpha = (0.28 + intensity * 0.42).toFixed(2);

    if (value < 0) {
      return {
        className: "stock-pick-card--score-down",
        styleAttr: ` style="--pick-score-alpha:${alpha}"`
      };
    }

    return {
      className: "stock-pick-card--score-up",
      styleAttr: ` style="--pick-score-alpha:${alpha}"`
    };
  }

  function isDeprecatedLogoUrl(url) {
    return /ssl\.pstatic\.net\/imgstock/i.test(url || "");
  }

  function normalizeImageUrl(url) {
    if (!url || typeof url !== "string") return "";
    const trimmed = url.trim();
    if (isDeprecatedLogoUrl(trimmed)) return "";
    if (/^https:\/\//i.test(trimmed)) return trimmed;
    if (/^http:\/\//i.test(trimmed)) return trimmed.replace(/^http:/i, "https:");
    return "";
  }

  function pickLogoUrlList(item) {
    const urls = [];
    const add = (candidate) => {
      const normalized = normalizeImageUrl(candidate);
      if (normalized && !urls.includes(normalized)) urls.push(normalized);
    };

    add(item.imageUrl);
    add(item.logoUrl);

    for (const article of [...(item.bullishArticles || []), ...(item.bearishArticles || [])]) {
      add(article?.imageUrl);
    }

    const ticker = String(item.ticker || "");
    const krMatch = ticker.match(/^(\d{6})\.(KS|KQ)$/i);
    if (krMatch) {
      const code = krMatch[1];
      const exchange = krMatch[2].toUpperCase();
      add(`https://images.financialmodelingprep.com/symbol/${code}.${exchange}.png`);
      add(`https://financialmodelingprep.com/image-stock/${code}.png`);
    }

    const symbol = ticker.split(".")[0].toUpperCase();
    if (item.market === "us" || (/^[A-Z]{1,5}$/.test(symbol) && !krMatch)) {
      add(`https://images.financialmodelingprep.com/symbol/${symbol}.png`);
      add(`https://financialmodelingprep.com/image-stock/${symbol}.png`);
    }

    return urls;
  }

  function pickThumbOnError(img) {
    const rest = (img.dataset.fallbacks || "").split("|").filter(Boolean);
    if (rest.length) {
      img.dataset.fallbacks = rest.slice(1).join("|");
      img.src = rest[0];
      return;
    }
    const initial = escapeHtml(img.dataset.initial || "?");
    const wrap = img.parentElement;
    if (wrap) {
      wrap.innerHTML = `<span class="stock-pick-thumb stock-pick-thumb--initial">${initial}</span>`;
    }
  }

  if (!window.__pickThumbOnError) {
    window.__pickThumbOnError = pickThumbOnError;
  }

  function pickThumbHtml(item) {
    const urls = pickLogoUrlList(item);
    const initial = escapeHtml((item.name || item.ticker || "?").charAt(0).toUpperCase());
    if (!urls.length) {
      return `<span class="stock-pick-thumb stock-pick-thumb--initial">${initial}</span>`;
    }

    const encoded = urls.map(escapeHtml);
    const first = encoded[0];
    const rest = encoded.slice(1).join("|");
    return `<span class="stock-pick-thumb-wrap"><img class="stock-pick-thumb" src="${first}" alt="" loading="lazy" decoding="async" data-fallbacks="${rest}" data-initial="${initial}" onerror="window.__pickThumbOnError(this)"></span>`;
  }

  function renderPickArticleItem(article) {
    const title = escapeHtml(article.title || "제목 없음");
    const summary = escapeHtml(article.summaryShort || "");
    const time = formatTime(article.publishedAt);
    const link = article.link ? escapeHtml(article.link) : "";
    const thumbHtml = headlineThumbHtml(article, link);
    const linkHtml = link
      ? `<a class="stock-pick-article-link" href="${link}" target="_blank" rel="noopener noreferrer">원문 →</a>`
      : "";

    return `
      <article class="stock-pick-article${thumbHtml ? " stock-pick-article--has-thumb" : ""}">
        <div class="stock-pick-article-body">
          ${thumbHtml}
          <div class="stock-pick-article-content">
            <h4 class="stock-pick-article-title">${title}</h4>
            ${summary ? `<p class="stock-pick-article-summary">${summary}</p>` : ""}
            <div class="stock-pick-article-meta">
              ${time ? `<time class="stock-pick-article-time">${time}</time>` : ""}
              ${linkHtml}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function renderPickNewsPanel(articles, sentiment, pickIdx, count, ticker, market) {
    if (!count) {
      return "";
    }
    const label = sentiment === "bullish" ? "호재" : "악재";
    const hasArticles = Array.isArray(articles) && articles.length > 0;
    const listBody = hasArticles
      ? articles.map((article) => renderPickArticleItem(article)).join("")
      : `<p class="stock-pick-news-panel-placeholder">관련 뉴스를 불러오는 중…</p>`;

    return `
      <div class="stock-pick-news-panel" id="pick-news-${sentiment}-${pickIdx}" data-sentiment="${sentiment}" data-ticker="${escapeHtml(ticker)}" data-market="${escapeHtml(market)}" data-loaded="${hasArticles ? "1" : ""}" hidden>
        <p class="stock-pick-news-panel-title">${label} 뉴스 ${count}건</p>
        <div class="stock-pick-article-list">
          ${listBody}
        </div>
      </div>
    `;
  }

  async function fetchHeadlines(market) {
    const base = getApiBase();
    if (!base) {
      throw new Error(
        "STOCK_API_URL이 설정되지 않았습니다. js/config.js에 Render 배포 URL을 넣거나 로컬 API(localhost:8000)를 사용하세요."
      );
    }

    if (headlinesAbortController) headlinesAbortController.abort();
    headlinesAbortController = new AbortController();

    const url = `${base}/api/headlines?market=${encodeURIComponent(market)}&limit=25&lang=ko`;
    await warmApi(base);
    return fetchJsonWithRetry(url, headlinesAbortController.signal, { retries: 2, timeoutMs: 90000 });
  }

  async function loadPickNewsPanel(panel) {
    if (!panel || panel.dataset.loaded === "1" || panel.dataset.loaded === "loading") {
      return;
    }

    panel.dataset.loaded = "loading";
    const listEl = panel.querySelector(".stock-pick-article-list");
    const sentiment = panel.dataset.sentiment;
    const ticker = panel.dataset.ticker;
    const market = panel.dataset.market || "kr";
    const label = sentiment === "bullish" ? "호재" : "악재";

    if (listEl) {
      listEl.innerHTML = `<p class="stock-pick-news-panel-placeholder">관련 뉴스를 불러오는 중…</p>`;
    }

    try {
      const headlineMarket = market === "us" ? "us" : "kr";
      const data = await fetchHeadlines(headlineMarket);
      const cutoff = Math.floor(Date.now() / 1000) - 7 * 86400;
      const articles = (data.items || [])
        .filter((item) => {
          if (item.publishedAt && item.publishedAt < cutoff) return false;
          if (item.sentiment !== sentiment) return false;
          const tickers = new Set([item.sourceTicker, ...(item.relatedTickers || [])].filter(Boolean));
          return tickers.has(ticker);
        })
        .slice(0, 5)
        .map((item) => ({
          title: item.title,
          summaryShort: item.summaryShort || item.summary,
          publishedAt: item.publishedAt,
          link: item.link,
          imageUrl: item.imageUrl
        }));

      if (!listEl) return;

      if (articles.length) {
        listEl.innerHTML = articles.map((article) => renderPickArticleItem(article)).join("");
      } else {
        listEl.innerHTML = `<p class="stock-pick-news-panel-empty">표시할 ${label} 기사가 없습니다. ↺ 새로고침으로 최신 분석을 받아보세요.</p>`;
      }
      panel.dataset.loaded = "1";
    } catch (_) {
      if (listEl) {
        listEl.innerHTML = `<p class="stock-pick-news-panel-empty">기사를 불러오지 못했습니다. 잠시 후 다시 시도하거나 ↺ 새로고침해 주세요.</p>`;
      }
      panel.dataset.loaded = "";
    }
  }

  function pickExternalChartUrl(ticker) {
    const krMatch = String(ticker || "").match(/^(\d{6})\.(KS|KQ)$/i);
    if (krMatch) {
      return `https://finance.naver.com/item/main.naver?code=${krMatch[1]}`;
    }
    return `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}/chart`;
  }

  function formatAccuracyPct(summary) {
    const pct = summary?.accuracy30d?.accuracyPct;
    if (pct == null) return "—";
    return `${pct}%`;
  }

  function formatAccuracyDetail(summary) {
    const d7 = summary?.accuracy7d?.accuracyPct;
    const d30 = summary?.accuracy30d?.accuracyPct;
    if (d7 == null && d30 == null) return "데이터 수집 중";
    const parts = [];
    if (d7 != null) parts.push(`7일 ${d7}%`);
    if (d30 != null) parts.push(`30일 ${d30}%`);
    return parts.join(" · ");
  }

  async function fetchAccuracySummary(market) {
    const base = getApiBase();
    if (!base) return null;
    const url = `${base}/api/predictions/summary?market=${encodeURIComponent(market)}&days=30`;
    try {
      await warmApi(base);
      return await fetchJsonWithRetry(url, null, { retries: 1, timeoutMs: 60000 });
    } catch (_) {
      return null;
    }
  }

  async function fetchPredictionHistory(ticker, market) {
    const base = getApiBase();
    if (!base) {
      throw new Error("STOCK_API_URL이 설정되지 않았습니다.");
    }
    const url = `${base}/api/predictions/history?ticker=${encodeURIComponent(ticker)}&market=${encodeURIComponent(market)}&days=30`;
    await warmApi(base);
    return fetchJsonWithRetry(url, null, { retries: 1, timeoutMs: 90000 });
  }

  function formatPredictionMatch(matched, row) {
    if (isCloseOnlyRow(row)) return "—";
    if (matched === true) return "일치";
    if (matched === false) return "불일치";
    return "대기";
  }

  function isCloseOnlyRow(row) {
    return row?.recommend_label === "—";
  }

  function formatTradeDate(value) {
    if (!value) return "—";
    const d = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" });
  }

  function renderPickAccuracyPanel(item, idx, marketId, summary) {
    const accText = formatAccuracyDetail(summary);
    return `
      <div class="stock-pick-accuracy-panel" id="pick-accuracy-${idx}" data-ticker="${escapeHtml(item.ticker)}" data-market="${escapeHtml(marketId)}" data-loaded="" hidden>
        <div class="stock-pick-accuracy-summary">
          <strong>예측 정확도</strong>
          <span data-accuracy-detail>${escapeHtml(accText)}</span>
          <span class="stock-pick-accuracy-hint">관망: ±0.5% · 추천: +0.5% 초과 · 주의: -0.5% 미만 · 종가·결과는 매일 16:00(KST) / 미국 장 마감 후 자동 반영 · — 는 종가만 표시(임시)</span>
        </div>
        <div class="stock-pick-accuracy-table-wrap" data-accuracy-table>
          <p class="stock-pick-accuracy-placeholder">최근 30일 예측 기록을 불러오는 중…</p>
        </div>
      </div>
    `;
  }

  function renderPickAccuracyTable(rows) {
    if (!rows?.length) {
      return `<p class="stock-pick-accuracy-empty">아직 기록된 예측이 없습니다. 매일 장 시작 전(한국 08:00 / 미국 08:00 ET)에 저장되고, 종가·적중 여부는 16:00(KST) 또는 미국 장 마감 후 반영됩니다.</p>`;
    }

    return `
      <table class="stock-pick-accuracy-table">
        <thead>
          <tr>
            <th>날짜</th>
            <th>점수</th>
            <th>예측</th>
            <th>종가</th>
            <th>전일대비</th>
            <th>결과</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const change = row.change_pct;
              const changeCls = change > 0 ? "up" : change < 0 ? "down" : "";
              const closeOnly = isCloseOnlyRow(row);
              const matchCls =
                row.matched === true ? "match" : row.matched === false ? "mismatch" : "pending";
              return `
                <tr>
                  <td>${escapeHtml(formatTradeDate(row.trade_date))}</td>
                  <td>${closeOnly ? "—" : escapeHtml(String(row.score ?? 0))}</td>
                  <td>${escapeHtml(closeOnly ? "—" : row.recommend_label || "—")}</td>
                  <td>${row.close_price != null ? formatPrice(row.close_price) : "—"}</td>
                  <td class="${changeCls}">${change != null ? formatPct(change) : "—"}</td>
                  <td class="stock-pick-accuracy-${closeOnly ? "pending" : matchCls}">${escapeHtml(formatPredictionMatch(row.matched, row))}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  async function loadPickAccuracyPanel(panel) {
    if (!panel || panel.dataset.loaded === "1" || panel.dataset.loaded === "loading") {
      return;
    }

    panel.dataset.loaded = "loading";
    const tableWrap = panel.querySelector("[data-accuracy-table]");
    const ticker = panel.dataset.ticker;
    const market = panel.dataset.market;
    if (tableWrap) {
      tableWrap.innerHTML = `<p class="stock-pick-accuracy-placeholder">최근 30일 예측 기록을 불러오는 중…</p>`;
    }

    try {
      const data = await fetchPredictionHistory(ticker, market);
      const summaryEl = panel.querySelector("[data-accuracy-detail]");
      if (summaryEl) {
        summaryEl.textContent = formatAccuracyDetail({
          accuracy7d: data.accuracy7d,
          accuracy30d: data.accuracy30d
        });
      }
      if (tableWrap) {
        tableWrap.innerHTML = renderPickAccuracyTable(data.items || []);
      }
      panel.dataset.loaded = "1";
    } catch (err) {
      panel.dataset.loaded = "";
      if (tableWrap) {
        tableWrap.innerHTML = `<p class="stock-pick-accuracy-error">${escapeHtml(formatFetchError(err, getApiBase()))}</p>`;
      }
    }
  }

  function closePickAccuracyOnCard(card) {
    card.querySelectorAll(".stock-pick-accuracy-panel").forEach((panel) => {
      panel.hidden = true;
    });
    card.querySelectorAll(".stock-pick-accuracy-toggle").forEach((btn) => {
      btn.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      const caret = btn.querySelector(".stock-pick-accuracy-caret");
      if (caret) caret.textContent = "▾";
    });
  }

  function bindPickAccuracyControls(listEl) {
    listEl.querySelectorAll(".stock-pick-accuracy-toggle").forEach((btn) => {
      btn.addEventListener("click", async (event) => {
        event.stopPropagation();
        const card = btn.closest(".stock-pick-card");
        const panel = card?.querySelector(".stock-pick-accuracy-panel");
        if (!card || !panel) return;

        const willOpen = panel.hidden;
        closePickAccuracyOnCard(card);
        closePickChartOnCard(card);
        closePickNewsOnCard(card);

        if (willOpen) {
          panel.dataset.loaded = "";
          panel.hidden = false;
          btn.classList.add("is-open");
          btn.setAttribute("aria-expanded", "true");
          const caret = btn.querySelector(".stock-pick-accuracy-caret");
          if (caret) caret.textContent = "▴";
          await loadPickAccuracyPanel(panel);
        }
      });
    });
  }

  function renderPickChartPanel(item, idx) {
    const externalUrl = escapeHtml(pickExternalChartUrl(item.ticker));
    return `
      <div class="stock-pick-chart-panel" id="pick-chart-${idx}" data-ticker="${escapeHtml(item.ticker)}" data-market="${escapeHtml(item.market)}" data-period="3mo" data-loaded="" hidden>
        <div class="stock-pick-chart-toolbar">
          <div class="stock-pick-chart-periods" role="tablist" aria-label="차트 기간">
            <button type="button" class="stock-pick-chart-period" data-period="1mo">1M</button>
            <button type="button" class="stock-pick-chart-period active" data-period="3mo">3M</button>
            <button type="button" class="stock-pick-chart-period" data-period="6mo">6M</button>
          </div>
          <a class="stock-pick-chart-external" href="${externalUrl}" target="_blank" rel="noopener noreferrer">상세 보기 →</a>
        </div>
        <div class="stock-pick-chart-wrap" data-chart-root hidden></div>
        <p class="stock-pick-chart-placeholder" data-chart-status hidden>차트를 불러오는 중…</p>
      </div>
    `;
  }

  function closePickNewsOnCard(card) {
    card.querySelectorAll(".stock-pick-news-panel").forEach((panel) => {
      panel.hidden = true;
    });
    card.querySelectorAll(".stock-pick-metric--toggle").forEach((btn) => {
      btn.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      const caret = btn.querySelector(".stock-pick-metric-caret");
      if (caret) caret.textContent = "▾";
    });
  }

  function closePickChartOnCard(card) {
    card.querySelectorAll(".stock-pick-chart-panel").forEach((panel) => {
      panel.hidden = true;
    });
    card.querySelectorAll(".stock-pick-name-toggle").forEach((btn) => {
      btn.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      const caret = btn.querySelector(".stock-pick-name-caret");
      if (caret) caret.textContent = "▾";
    });
  }

  function destroyPickChart(panel) {
    const state = pickChartState.get(panel);
    if (!state) return;
    if (state.resizeObserver) state.resizeObserver.disconnect();
    if (state.chart) {
      try {
        state.chart.remove();
      } catch (_) {
        /* noop */
      }
    }
    pickChartState.delete(panel);
    const root = panel.querySelector("[data-chart-root]");
    if (root) root.innerHTML = "";
  }

  function renderPickChart(chartRoot, candles) {
    if (!window.LightweightCharts || !candles?.length) return null;

    const chart = window.LightweightCharts.createChart(chartRoot, {
      width: chartRoot.clientWidth || 320,
      height: 280,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#334155"
      },
      grid: {
        vertLines: { color: "rgba(203, 213, 225, 0.9)" },
        horzLines: { color: "rgba(203, 213, 225, 0.9)" }
      },
      rightPriceScale: { borderColor: "#cbd5e1" },
      timeScale: { borderColor: "#cbd5e1", timeVisible: true, secondsVisible: false }
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#ef4444",
      downColor: "#3b82f6",
      borderUpColor: "#ef4444",
      borderDownColor: "#3b82f6",
      wickUpColor: "#ef4444",
      wickDownColor: "#3b82f6"
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume"
    });

    chart.priceScale("right").applyOptions({
      scaleMargins: { top: 0.08, bottom: 0.28 }
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 }
    });

    const ohlc = candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    }));

    const volumes = candles.map((c, i) => {
      const prevClose = i > 0 ? candles[i - 1].close : c.open;
      const up = c.close >= prevClose;
      return {
        time: c.time,
        value: c.volume || 0,
        color: up ? "rgba(239, 68, 68, 0.55)" : "rgba(59, 130, 246, 0.55)"
      };
    });

    candleSeries.setData(ohlc);
    volumeSeries.setData(volumes);
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: chartRoot.clientWidth || 320 });
    });
    resizeObserver.observe(chartRoot);

    return { chart, resizeObserver };
  }

  async function fetchChartData(ticker, period) {
    const cacheKey = `${ticker}:${period}`;
    if (pickChartDataCache.has(cacheKey)) {
      return pickChartDataCache.get(cacheKey);
    }

    const base = getApiBase();
    if (!base) {
      throw new Error(
        "STOCK_API_URL이 설정되지 않았습니다. js/config.js에 Render 배포 URL을 넣거나 로컬 API(localhost:8000)를 사용하세요."
      );
    }

    const url = `${base}/api/chart?ticker=${encodeURIComponent(ticker)}&period=${encodeURIComponent(period)}&interval=1d`;
    await warmApi(base);
    const data = await fetchJsonWithRetry(url, null, { retries: 2, timeoutMs: 120000 });
    pickChartDataCache.set(cacheKey, data);
    return data;
  }

  async function loadPickChartPanel(panel, period) {
    const periodToUse = period || panel.dataset.period || "3mo";
    panel.dataset.period = periodToUse;

    const statusEl = panel.querySelector("[data-chart-status]");
    const chartRoot = panel.querySelector("[data-chart-root]");
    const ticker = panel.dataset.ticker;
    if (!chartRoot || !ticker) return;

    if (panel.dataset.loaded === periodToUse && pickChartState.has(panel)) {
      return;
    }

    destroyPickChart(panel);
    panel.dataset.loaded = "loading";
    if (statusEl) {
      statusEl.className = "stock-pick-chart-placeholder";
      statusEl.textContent = "차트를 불러오는 중… (Render 서버 첫 요청은 최대 1분)";
      statusEl.hidden = false;
    }
    chartRoot.hidden = true;

    try {
      const data = await fetchChartData(ticker, periodToUse);
      if (!data?.candles?.length) {
        if (statusEl) {
          statusEl.className = "stock-pick-chart-error";
          statusEl.textContent = "표시할 차트 데이터가 없습니다.";
          statusEl.hidden = false;
        }
        panel.dataset.loaded = "";
        return;
      }

      chartRoot.hidden = false;
      const state = renderPickChart(chartRoot, data.candles);
      if (state) pickChartState.set(panel, state);
      panel.dataset.loaded = periodToUse;
      if (statusEl) statusEl.hidden = true;
    } catch (err) {
      panel.dataset.loaded = "";
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.className = "stock-pick-chart-error";
        statusEl.textContent = formatFetchError(err, getApiBase());
      }
    }
  }

  function bindPickChartControls(listEl) {
    listEl.querySelectorAll(".stock-pick-name-toggle").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const card = btn.closest(".stock-pick-card");
        const panel = card?.querySelector(".stock-pick-chart-panel");
        if (!card || !panel) return;

        const willOpen = panel.hidden;
        closePickChartOnCard(card);
        closePickAccuracyOnCard(card);
        closePickNewsOnCard(card);

        if (willOpen) {
          panel.hidden = false;
          btn.classList.add("is-open");
          btn.setAttribute("aria-expanded", "true");
          const caret = btn.querySelector(".stock-pick-name-caret");
          if (caret) caret.textContent = "▴";
          await loadPickChartPanel(panel);
        }
      });
    });

    listEl.querySelectorAll(".stock-pick-chart-period").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const panel = btn.closest(".stock-pick-chart-panel");
        if (!panel || panel.hidden) return;
        const period = btn.dataset.period;
        if (!period) return;
        panel.querySelectorAll(".stock-pick-chart-period").forEach((other) => {
          other.classList.toggle("active", other === btn);
        });
        panel.dataset.loaded = "";
        await loadPickChartPanel(panel, period);
      });
    });
  }

  function bindPickCards(listEl) {
    listEl.querySelectorAll(".stock-pick-metric--toggle").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const card = btn.closest(".stock-pick-card");
        if (!card) return;
        const sentiment = btn.dataset.sentiment;
        const panel = card.querySelector(`.stock-pick-news-panel[data-sentiment="${sentiment}"]`);
        if (!panel) return;

        const willOpen = panel.hidden;

        closePickChartOnCard(card);
        closePickAccuracyOnCard(card);
        card.querySelectorAll(".stock-pick-news-panel").forEach((other) => {
          other.hidden = true;
        });
        card.querySelectorAll(".stock-pick-metric--toggle").forEach((otherBtn) => {
          otherBtn.classList.remove("is-open");
          otherBtn.setAttribute("aria-expanded", "false");
          const caret = otherBtn.querySelector(".stock-pick-metric-caret");
          if (caret) caret.textContent = "▾";
        });

        if (willOpen) {
          panel.hidden = false;
          btn.classList.add("is-open");
          btn.setAttribute("aria-expanded", "true");
          const caret = btn.querySelector(".stock-pick-metric-caret");
          if (caret) caret.textContent = "▴";
          await loadPickNewsPanel(panel);
        }
      });
    });
  }

  function renderNewsSentimentCard(item, idx, market) {
    const change = item.changePct;
    const changeCls = change > 0 ? "up" : change < 0 ? "down" : "";
    const rank = item.rank ?? idx + 1;
    const label = item.recommendLabel || item.stanceLabel || "관망";
    const stanceCls = pickStanceClass(item.stance);
    const bullishCount = item.bullishNews ?? 0;
    const bearishCount = item.bearishNews ?? 0;
    const noNewsHint =
      bullishCount === 0 && bearishCount === 0
        ? " · Yahoo 종목 뉴스 피드에 최근 7일 기사 없음"
        : "";
    const windowDays = item.newsWindowDays ?? 7;
    const windowHint =
      item.newsAnalyzedFrom && item.newsAnalyzedTo
        ? ` · ${formatTime(item.newsAnalyzedFrom)} ~ ${formatTime(item.newsAnalyzedTo)}`
        : "";
    const bullishArticles = item.bullishArticles || [];
    const bearishArticles = item.bearishArticles || [];
    const scoreAppearance = pickScoreAppearance(item.score);
    const tickerSummary = picksAccuracySummary?.tickers?.[item.ticker];
    const accuracyLabel = formatAccuracyPct(tickerSummary);

    return `
      <article class="stock-pick-card stock-pick-card--${stanceCls} ${scoreAppearance.className}"${scoreAppearance.styleAttr}>
        <div class="stock-pick-header">
          ${pickThumbHtml(item)}
          <span class="stock-pick-rank">#${rank}</span>
          <div class="stock-pick-title-wrap">
            <div class="stock-pick-title-row">
              <button type="button" class="stock-pick-name-toggle" aria-expanded="false" aria-controls="pick-chart-${idx}">
                <span class="stock-pick-name-text">${escapeHtml(item.name)}</span>
                <span class="stock-pick-name-caret">▾</span>
              </button>
              <button type="button" class="stock-pick-accuracy-toggle" aria-expanded="false" aria-controls="pick-accuracy-${idx}">
                예측 ${escapeHtml(accuracyLabel)} <span class="stock-pick-accuracy-caret">▾</span>
              </button>
            </div>
            <div class="stock-pick-ticker">${escapeHtml(item.ticker)} · ${escapeHtml(marketLabel(item.market))}</div>
            <p class="stock-pick-window">최근 ${windowDays}일 뉴스 기준${windowHint}${noNewsHint}</p>
          </div>
          <span class="stock-pick-score">점수 ${escapeHtml(String(item.score ?? 0))}</span>
        </div>
        ${renderPickChartPanel(item, idx)}
        ${renderPickAccuracyPanel(item, idx, market, tickerSummary)}
        <div class="stock-pick-metrics">
          <span class="stock-pick-metric stock-pick-metric--stance ${stanceCls}">${escapeHtml(label)}</span>
          <span class="stock-pick-metric">가격 ${formatPrice(item.price)}</span>
          <span class="stock-pick-metric ${changeCls}">1일 ${formatPct(change)}</span>
          <button type="button" class="stock-pick-metric stock-pick-metric--toggle up" data-sentiment="bullish" aria-expanded="false" aria-controls="pick-news-bullish-${idx}"${bullishCount ? "" : " disabled"}>
            호재 ${bullishCount} <span class="stock-pick-metric-caret">▾</span>
          </button>
          <button type="button" class="stock-pick-metric stock-pick-metric--toggle down" data-sentiment="bearish" aria-expanded="false" aria-controls="pick-news-bearish-${idx}"${bearishCount ? "" : " disabled"}>
            악재 ${bearishCount} <span class="stock-pick-metric-caret">▾</span>
          </button>
        </div>
        ${renderPickNewsPanel(bullishArticles, "bullish", idx, bullishCount, item.ticker, item.market)}
        ${renderPickNewsPanel(bearishArticles, "bearish", idx, bearishCount, item.ticker, item.market)}
        <p class="stock-pick-reason">${escapeHtml(item.reason)}</p>
      </article>
    `;
  }

  function renderItems(listEl, items, marketId, options = {}) {
    if (!listEl) return;

    destroy();

    if (!items?.length) {
      listEl.innerHTML = `<p class="stock-empty">추천할 종목을 찾지 못했습니다. 잠시 후 새로고침해 보세요.</p>`;
      activeListEl = null;
      return;
    }

    const market = marketId || options.defaultMarket || "kr_kospi";
    const layout = options.layout || "news-sentiment";

    let cardHtml;
    if (layout === "news-sentiment") {
      cardHtml = items.map((item, idx) => renderNewsSentimentCard(item, idx, market)).join("");
    } else {
      cardHtml = items.map((item, idx) => renderNewsSentimentCard(item, idx, market)).join("");
    }

    listEl.innerHTML = `
      <div class="stock-picks-list">
        ${cardHtml}
      </div>
    `;

    activeListEl = listEl;
    bindPickCards(listEl);
    bindPickChartControls(listEl);
    bindPickAccuracyControls(listEl);
  }

  async function refreshAccuracySummary(listEl, items, market) {
    const summary = await fetchAccuracySummary(market);
    if (summary) {
      picksAccuracySummary = summary;
      renderItems(listEl, items, market);
    }
  }

  function setAccuracySummary(summary) {
    picksAccuracySummary = summary;
  }

  function getAccuracySummary() {
    return picksAccuracySummary;
  }

  function destroy() {
    if (headlinesAbortController) {
      headlinesAbortController.abort();
      headlinesAbortController = null;
    }
    if (activeListEl) {
      activeListEl.querySelectorAll(".stock-pick-chart-panel").forEach((panel) => {
        destroyPickChart(panel);
      });
    }
    activeListEl = null;
  }

  window.DwStockPicksRenderer = {
    renderItems,
    refreshAccuracySummary,
    setAccuracySummary,
    getAccuracySummary,
    destroy
  };
})();
