/**
 * 장기 추천 — 공통 UI·가이드(배경+기술) 문구
 */
(function () {
  const NY_TZ = "America/New_York";

  const FUNDAMENTAL_GUIDES = [
    {
      id: "per",
      label: "PER (주가수익비율)",
      background:
        "벤저민 그레이엄 이후 가치투자의 기본 척도입니다. 주가가 기업이 벌어들이는 이익에 비해 얼마나 비싼지를 봅니다. " +
        "시장이 성장 스토리에 과도하게 낙관할 때 PER이 부풀고, 침체·실적 악화 시 과도하게 낮아지기도 합니다. " +
        "장기 투자에서는 ‘싸다’만으로 충분하지 않지만, 동종 업종·유사 성장률 대비 PER을 비교하면 상대적 고평가·저평가 후보를 거르는 데 유용합니다.",
      technical:
        "Trailing PER = 주가 ÷ 최근 12개월 주당순이익(EPS). 0 < PER ≤ 100, 적자 종목 제외. 낮을수록 이익 대비 주가가 낮음.",
      caution: "일회성 이익·회계 변경·사이클 정점의 이익은 PER을 일시적으로 낮춰 보일 수 있습니다."
    },
    {
      id: "roe",
      label: "ROE (자기자본이익률)",
      background:
        "워런 버핏이 강조한 ‘좋은 기업’의 핵심 지표 중 하나입니다. 주주가 넣은 자본으로 얼마나 효율적으로 이익을 내는지 보여 줍니다. " +
        "높은 ROE가 지속되면 브랜드·가격결정력·진입장벽이 있다는 신호로 해석되는 경우가 많습니다. " +
        "다만 레버리지(부채)로 ROE를 끌어올린 경우도 있어 PBR·부채비율과 함께 보는 것이 좋습니다.",
      technical: "ROE = 당기순이익 ÷ 자기자본. 본 서비스는 Yahoo Finance returnOnEquity(비율) 기준, 높은 순 TOP 20.",
      caution: "금융·보험은 ROE 해석이 일반 제조·IT와 다릅니다."
    },
    {
      id: "pbr",
      label: "PBR (주가순자산비율)",
      background:
        "주가가 장부상 순자산(청산가치에 가까운 개념) 대비 얼마인지를 봅니다. 1배 미만이면 이론상 자산을 할인해 사는 셈이지만, " +
        "자산 가치 하락·구조적 쇠퇴 업종에서는 ‘함정’이 될 수 있습니다. 소형주·저PBR 전략과 결합할 때 자주 쓰이며, " +
        "장기적으로는 자산 대비 과도하게 깎인 우량 소형주를 찾는 데 쓰는 경우가 있습니다.",
      technical: "PBR = 주가 ÷ 주당순자산(BPS). 0 < PBR ≤ 20, 낮은 순 TOP 20.",
      caution: "무형자산·브랜드가 큰 기업은 장부 자산만으로 가치를 잡기 어렵습니다."
    },
    {
      id: "dividend",
      label: "배당수익률",
      background:
        "장기 보유 시 ‘현금 흐름’ 관점에서 매력을 보는 지표입니다. 성장주보다 현금 배당에 초점을 맞춘 투자·은퇴 포트폴리오에서 자주 쓰입니다. " +
        "배당이 높다고 무조건 좋은 것은 아니며, 배당 삭감·일회성 특별배당·과도한 부채 배당은 주의가 필요합니다. " +
        "배당 성향·FCF(잉여현금흐름)와 함께 보면 지속 가능성을 가늠할 수 있습니다.",
      technical: "배당수익률 = 연간 배당금 ÷ 주가. 배당 > 0 종목만, 높은 순 TOP 20.",
      caution: "고배당은 주가 하락으로 수익률이 부풀어 오른 경우일 수 있습니다."
    }
  ];

  const STRATEGY_GUIDES = [
    {
      id: "small-cap-pbr",
      label: "소형주 + 저PBR",
      background:
        "일본·한국 등에서 ‘소형주 효과’와 ‘저PBR’이 겹치는 조합으로 연구·실무에서 자주 언급됩니다. " +
        "대형주는 이미 많은 분석이 반영되어 있지만, 소형주는 정보 비대칭·유동성 할인으로 저평가될 여지가 남는다는 가정입니다. " +
        "여기에 자산 대비 주가가 낮은(PBR) 종목을 골라 ‘이중 필터’를 씁니다. 장기 보유·분산 투자 전제이며, 개별 종목 리스크는 큽니다.",
      technical:
        "시장별 TOP 200 청크 스캔 → 시가총액 하위 50% 소형주 → PBR 낮은 순 TOP 2. 데이터: marketCap, priceToBook.",
      caution: "유니버스는 정적 TOP 리스트 기준이며, 실시간 초소형주 전체 시장은 아닙니다."
    },
    {
      id: "magic-formula",
      label: "마법 공식 (조엘 그린블랫)",
      background:
        "《마법 공식》 저자 조엘 그린블랫이 제시한 규칙형 가치·퀄리티 스크리닝입니다. " +
        "‘싼 주식’(높은 수익률 = EBIT/기업가치)과 ‘좋은 주식’(높은 ROC = 자본 대비 이익)을 동시에 찾아 순위를 합산합니다. " +
        "단기 성과보다 수년 단위로 우량·저평가 조합이 복리에 유리했다는 백테스트가 알려져 있으나, 금융주·극단적 사이클 종목은 제외하는 것이 원칙에 가깝습니다.",
      technical:
        "EBIT/EV(수익률) 순위 + ROC 순위 → 합산 순위 낮을수록 상위 TOP 2. 금융·적자·데이터 누락 제외. TOP 150 청크 스캔.",
      caution: "Yahoo 데이터로 ROC·EBIT을 근사하며, 원서와 완전 동일하지 않을 수 있습니다."
    },
    {
      id: "f-score",
      label: "피오트로스키 F-스코어",
      background:
        "조셉 피오트로스키(Stanford)가 논문에서 제시한 재무 건전성·개선 점수입니다. " +
        "가치지표로 ‘싸 보이는’ 종목 중 재무적으로 회복·개선 중인 기업을 골라 ‘value trap’을 줄이려는 목적이 큽니다. " +
        "특히 장부가치 대비 저평가 구간에서 F-Score가 높은 종목이 상대적으로 나은 성과를 보였다는 연구가 있습니다. 미국 대형·중형주에서 검증이 많고, 한국 종목은 재무제표 누락이 잦습니다.",
      technical:
        "9개 이진 항목(순이익·ROA·영업CF·이익의 질·부채·유동성·발행주식·마진·회전율) 전년 대비 개선 여부. 7점 이상 TOP 2.",
      caution: "연간 재무제표 2개년 필요 — 한국 티커는 점수 산출 실패 비율이 높을 수 있습니다."
    }
  ];

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

  function renderGuideSection(guide, { collapsible = true } = {}) {
    const body = `
        <p class="long-term-guide-bg"><strong>배경</strong> ${escapeHtml(guide.background)}</p>
        <p class="long-term-guide-tech"><strong>기술·규칙</strong> ${escapeHtml(guide.technical)}</p>
        ${guide.caution ? `<p class="long-term-guide-caution"><strong>유의</strong> ${escapeHtml(guide.caution)}</p>` : ""}`;
    if (!collapsible) {
      return `
      <section class="long-term-guide-block">
        <h3 class="long-term-guide-title">${escapeHtml(guide.label)}</h3>
        ${body}
      </section>`;
    }
    return `
      <details class="long-term-guide-details">
        <summary class="long-term-guide-summary">${escapeHtml(guide.label)}</summary>
        <div class="long-term-guide-body">${body}</div>
      </details>`;
  }

  function renderCollapsibleStrategyGuide(guide) {
    if (!guide) return "";
    return `
      <details class="long-term-guide-details long-term-strategy-guide-details">
        <summary class="long-term-guide-summary">${escapeHtml(guide.label)} — 로직 설명</summary>
        <div class="long-term-guide-body">
          <p class="long-term-guide-bg"><strong>배경</strong> ${escapeHtml(guide.background)}</p>
          <p class="long-term-guide-tech"><strong>기술·규칙</strong> ${escapeHtml(guide.technical)}</p>
          ${guide.caution ? `<p class="long-term-guide-caution"><strong>유의</strong> ${escapeHtml(guide.caution)}</p>` : ""}
        </div>
      </details>`;
  }

  function renderAllGuides() {
    let html = `<p class="long-term-intro">가치·배당 지표(PER·ROE·PBR·배당)와 장기 스크리닝 3종(소형·저PBR, 마법 공식, F-스코어)의 <strong>배경</strong>과 <strong>계산 방식</strong>을 정리했습니다. 단기 매매가 아닌 장기 관점 참고용입니다.</p>`;
    html += `<h3 class="long-term-section-heading">가치·배당 지표 (PER · ROE · PBR · 배당)</h3>`;
    FUNDAMENTAL_GUIDES.forEach((g) => {
      html += renderGuideSection(g);
    });
    html += `<h3 class="long-term-section-heading">장기 스크리닝 3종</h3>`;
    STRATEGY_GUIDES.forEach((g) => {
      html += renderGuideSection(g);
    });
    html += `<p class="recommend2-disclaimer">Yahoo Finance 비공식 데이터 기준이며 투자 권유가 아닙니다. Push 알림에 포함되지 않습니다.</p>`;
    return html;
  }

  function renderFourMarketSummary(summary) {
    const rec = window.StockRecommendationHistory;
    if (rec?.renderSummaryBar) {
      return rec.renderSummaryBar(summary);
    }
    return "";
  }

  function renderTop100Table(items) {
    const rows = items || [];
    if (!rows.length) {
      return `<p class="recommend2-empty">스캔된 종목이 없습니다. 청크 스캔 진행 후 수치·스코어 순으로 표시됩니다.</p>`;
    }
    return `
      <div class="fundamentals-table-wrap long-term-top100-wrap">
        <table class="recommend2-match-table fundamentals-table long-term-top100-table">
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col">종목</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => {
                const rank = row.rank ?? "—";
                const name = row.name || "—";
                return `
              <tr>
                <td class="fundamentals-rank">${escapeHtml(String(rank))}</td>
                <td class="long-term-top100-name">${escapeHtml(name)}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
        <p class="long-term-history-note">4개 시장 스캔 종목 중 수치·스코어 순 TOP ${rows.length} (최대 100)</p>
      </div>`;
  }

  function renderHistoryTable(history, { strategyId = null, summary = null } = {}) {
    const rec = window.StockRecommendationHistory;
    if (rec?.renderHistoryTable) {
      return rec.renderHistoryTable(history, { strategyId, summary });
    }
    return `<p class="recommend2-empty">추천 이력 모듈을 불러오지 못했습니다.</p>`;
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

  function renderPicksTable(picks, label, { interim = false, recommendRatePct = null, pickLimit = null } = {}) {
    if (!picks?.length) {
      return `<p class="recommend2-empty">${escapeHtml(label)} 추천이 아직 없습니다. 청크 스캔 진행 중일 수 있습니다.</p>`;
    }
    const rateNote =
      recommendRatePct != null
        ? `<p class="long-term-rate-note">추천 ${picks.length}${pickLimit ? `/${pickLimit}` : ""}종${recommendRatePct != null ? ` · ${escapeHtml(String(recommendRatePct))}%` : ""}${interim ? " · 스캔 진행 중(잠정)" : ""}</p>`
        : "";
    return `
      ${rateNote}
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

  function top100SectionHtml(title) {
    const heading = title || "추천 종목 TOP 100 (수치·스코어 순)";
    return `
      <section class="long-term-top100-section stock-rec-history-section">
        <h3 class="long-term-history-heading">${escapeHtml(heading)}</h3>
        <div class="long-term-top100-mount"></div>
      </section>`;
  }

  window.LongTermShared = {
    FUNDAMENTAL_GUIDES,
    STRATEGY_GUIDES,
    escapeHtml,
    formatPrice,
    formatDate,
    formatUpdatedNy,
    stockLink,
    renderAllGuides,
    renderGuideSection,
    renderHistoryTable,
    renderPicksTable,
    renderPickRow,
    renderCollapsibleStrategyGuide,
    renderFourMarketSummary,
    renderTop100Table,
    top100SectionHtml,
    historySectionHtml: top100SectionHtml,
  };
})();
