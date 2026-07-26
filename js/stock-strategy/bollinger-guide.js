/**
 * 볼린저밴드 — 활용 가이드 (정적)
 */
(function () {
  function renderHtml() {
    return `
      <article class="golden-guide-panel" aria-label="볼린저밴드 활용 가이드">
        <header class="golden-guide-header">
          <h2 class="golden-guide-title">볼린저밴드 · 활용 가이드</h2>
          <p class="golden-guide-lead">BB(20, 2σ) 하단 반등 · 상단 돌파 · KOSPI TOP 100 · 2026년 4~6월 백테스트 요약</p>
        </header>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">① 횡보장 (박스권): 볼린저 밴드의 최적의 활동 무대</h3>
          <p>볼린저 밴드는 본래 주가가 밴드 안에서 움직일 확률(약 <strong>95%</strong>)을 전제로 합니다. 따라서 <strong>횡보장에서는 최고의 성과</strong>를 냅니다.</p>

          <h4 class="golden-guide-subheading">전략</h4>
          <p>하단 밴드에 닿으면 매수, 상단 밴드에 닿으면 매도.</p>

          <h4 class="golden-guide-subheading">성공 조건</h4>
          <p>주가가 일정한 박스권을 유지할 때 매우 정확한 타점을 제공합니다.</p>

          <h4 class="golden-guide-subheading">리스크</h4>
          <p>박스권을 강하게 돌파하는 추세가 시작될 때, 미리 상단에서 매도했다가 큰 수익을 놓칠 수 있습니다.</p>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">② 상승장: 밴드 워킹(Band Walking)의 발생</h3>
          <p>강한 상승장에서는 볼린저 밴드가 오히려 매도 신호처럼 보일 수 있어 위험합니다.</p>

          <h4 class="golden-guide-subheading">현상</h4>
          <p>강력한 상승장에서는 주가가 상단 밴드를 타고 올라가는 <strong>밴드 워킹(Band Walking)</strong> 현상이 나타납니다.</p>

          <h4 class="golden-guide-subheading">위험성</h4>
          <p>초보자들은 주가가 상단 밴드에 닿았으니 과매수라고 판단하여 <strong>매도</strong>하지만, 실제로는 추세가 너무 강해 주가가 밴드를 뚫고 계속 상승합니다.</p>

          <h4 class="golden-guide-subheading">전략</h4>
          <p>상승장에서는 밴드 상단 이탈을 매도 신호로 보지 말고, <strong>추세가 매우 강하다</strong>는 신호로 해석해야 합니다. 오히려 <strong>중심선(20일 이동평균선)</strong>을 지지받고 다시 튀어 오르는지를 확인하는 것이 좋습니다.</p>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">③ 하락장: 음의 밴드 워킹</h3>
          <p>상승장과 반대로 하락장에서는 하단 밴드를 뚫고 계속 내려가는 현상이 발생합니다.</p>

          <h4 class="golden-guide-subheading">현상</h4>
          <p>하단 밴드에 닿았다고 해서 <strong>과매도</strong>라고 생각하고 덥석 매수했다가는, 하락 추세가 이어지며 큰 손실을 봅니다.</p>

          <h4 class="golden-guide-subheading">전략</h4>
          <p>하락장에서는 하단 밴드 돌파 시 매수보다는, 하락세가 멈추고 <strong>밴드 폭이 다시 좁아지며 중심선을 회복</strong>하는지를 확인하는 것이 훨씬 안전합니다.</p>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">④ KOSPI TOP 100 · 4~6월 수익률 비교</h3>
          <p class="golden-guide-note">바로 매입(현재 앱) · 추천일(T) 종가 매입 → 1일차 T+1 종가 · 2일차 T+2 종가 · yfinance 6mo 재스캔</p>

          <h4 class="golden-guide-subheading">바로 매입 — 월별 합산 (현재 앱 규칙)</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead>
              <tr><th>월</th><th>신호 수</th><th>1일차 합산</th><th>2일차 합산</th><th>건당 평균(1일차)</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>2026-04</strong></td><td>319</td><td><strong>+102.6%</strong></td><td><strong>+355.9%</strong></td><td>약 +0.32%</td></tr>
              <tr><td><strong>2026-05</strong></td><td>273</td><td><strong>+279.0%</strong></td><td><strong>+306.6%</strong></td><td>약 +1.02%</td></tr>
              <tr><td><strong>2026-06</strong></td><td>312</td><td><strong>−258.8%</strong></td><td><strong>−277.2%</strong></td><td>약 −0.83%</td></tr>
              <tr><td><strong>4~6월 합</strong></td><td>904</td><td><strong>+122.8%</strong></td><td><strong>+385.3%</strong></td><td>—</td></tr>
            </tbody>
          </table>

          <ul class="golden-guide-list">
            <li><strong>4~5월</strong>: 1·2일차 모두 <strong>큰 플러스</strong> — 강한 상승장에서 하단 반등·상단 돌파 모두 익일 수익에 유리.</li>
            <li><strong>5월</strong>: 1일차 합산 <strong>+279%</strong>로 4~6월 중 <strong>최고</strong>.</li>
            <li><strong>6월</strong>: 1·2일차 <strong>동시 마이너스</strong> — 고점 조정·급락일 다수로 휩쏘·가짜 반등 증가.</li>
          </ul>

          <h4 class="golden-guide-subheading">1일 지연 매입 — 참고 (월별 합산)</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead>
              <tr><th>월</th><th>1일차 합산</th><th>2일차 합산</th><th>바로 vs 지연 (1일차)</th></tr>
            </thead>
            <tbody>
              <tr><td>2026-04</td><td>+250.8%</td><td>+601.4%</td><td>지연 <strong>유리</strong> (+251% vs +103%)</td></tr>
              <tr><td>2026-05</td><td>+22.5%</td><td>−150.3%</td><td>바로 <strong>유리</strong> (+279% vs +23%)</td></tr>
              <tr><td>2026-06</td><td>−21.6%</td><td>+271.9%</td><td>6월 1일차는 지연이 덜 나쁨, 2일차는 지연만 플러스</td></tr>
            </tbody>
          </table>
          <p>→ 매입 타이밍에 따라 <strong>월별 최적이 다름</strong>. 한 가지 규칙으로 고정하기 어렵습니다.</p>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">⑤ KOSPI 장세와의 연결</h3>
          <table class="recommend2-match-table golden-guide-table">
            <thead>
              <tr><th>월</th><th>KOSPI(^KS11) 월간</th><th>볼린저 바로 1일차</th><th>해석</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>4월</strong></td>
                <td><strong>+20.4%</strong> (낙폭 −4.5%)</td>
                <td>+102.6%</td>
                <td>상승장 — 반등·돌파 신호 모두 우호적</td>
              </tr>
              <tr>
                <td><strong>5월</strong></td>
                <td><strong>+22.2%</strong></td>
                <td>+279.0%</td>
                <td>강한 상승 · 밴드 워킹 구간 — 상단 돌파도 유리</td>
              </tr>
              <tr>
                <td><strong>6월</strong></td>
                <td><strong>−3.5%</strong> (고점 대비 −15%)</td>
                <td>−258.8%</td>
                <td>조정·변동성 — 하단 반등 함정·횡보 휩쏘</td>
              </tr>
            </tbody>
          </table>

          <h4 class="golden-guide-subheading">한 줄 정리</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>질문</th><th>답</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>4~5월 vs 6월</strong></td>
                <td>4~5월 <strong>대세 상승</strong> → 바로 매입 1·2일차 플러스 / 6월 <strong>고점 조정·급락</strong> → 바로 매입 1·2일차 마이너스</td>
              </tr>
              <tr>
                <td><strong>전략과 장세</strong></td>
                <td>횡보·박스권에 강한 BB도, <strong>6월처럼 방향 없는 조정</strong>에서는 하단 반등·상단 돌파 모두 <strong>가짜 신호</strong>가 늘어남</td>
              </tr>
              <tr>
                <td><strong>6월 대응</strong></td>
                <td>하단 터치만으로 매수하지 말고 <strong>밴드 수축 + 중심선 회복</strong> 확인 (③ 하락장·조정 가이드)</td>
              </tr>
            </tbody>
          </table>
        </section>

        <p class="long-term-guide-caution golden-guide-caution">
          위 %는 <strong>신호별 수익률 단순 합산</strong>이며, 포트폴리오·복리 수익과 다릅니다. Yahoo Finance · KOSPI TOP 100 기준 · 투자 권유 아님.
        </p>
      </article>`;
  }

  window.StockStrategyBollingerGuide = { renderHtml };
})();
