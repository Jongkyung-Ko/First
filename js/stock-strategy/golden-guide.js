/**
 * 골든크로스 — 활용 가이드 (정적)
 */
(function () {
  function renderHtml() {
    return `
      <article class="golden-guide-panel" aria-label="골든크로스 활용 가이드">
        <header class="golden-guide-header">
          <h2 class="golden-guide-title">골든크로스 · 활용 가이드</h2>
          <p class="golden-guide-lead">KOSPI TOP 100 · 2026년 4~6월 백테스트 요약 (yfinance 6mo 재스캔)</p>
        </header>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">③ 결론 — 왜 4월과 6월이 이렇게 다른가?</h3>

          <h4 class="golden-guide-subheading">전략 성격 (추세 추종)</h4>
          <p>골든크로스는 <strong>정배열 + SMA5·SMA20 골든크로스 = 상승 추세</strong>를 전제로 합니다. 성과도 <strong>신호 다음날 종가 상승 여부</strong>(<code>dayReturnPct</code>) 기준입니다.</p>
          <ul class="golden-guide-list">
            <li><strong>4~5월</strong>: 지수·종목 <strong>연속 상승</strong> → 익일도 이어 오르는 경우가 많음 (4월 승률 <strong>58%</strong>).</li>
            <li><strong>6월</strong>: 고점 이후 <strong>급락·반등 반복</strong> → 신호는 나와도 익일 <strong>−</strong>인 경우가 많음 (승률 <strong>33%</strong>).</li>
          </ul>
          <p>→ <strong>전략이 나빠진 것이 아니라, 6월 장세가 추세추종에 불리</strong>했습니다.</p>

          <h4 class="golden-guide-subheading">신호 질·구성 변화</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>패턴</th><th>4월</th><th>6월</th></tr></thead>
            <tbody>
              <tr><td><strong>align</strong> (정배열)</td><td>450건</td><td>150건</td></tr>
              <tr><td><strong>golden</strong> (골든만)</td><td>296건</td><td><strong>277건</strong></td></tr>
              <tr><td><strong>strong</strong></td><td>144건</td><td>48건</td></tr>
            </tbody>
          </table>
          <ul class="golden-guide-list">
            <li>4월: <strong>정배열(align) 신호</strong>가 많아 강한 추세와 맞물림.</li>
            <li>6월: <strong>golden만</strong> 비중 증가, align 감소 → <strong>약한·뒤늦은 신호</strong> 증가.</li>
            <li>6월 신호일 <strong>상승 마감 비율 45%</strong> (4월 <strong>68%</strong>) → 흔들리는 날에 신호가 더 많이 잡힘.</li>
          </ul>

          <h4 class="golden-guide-subheading">신호 밀도·급락일 겹침</h4>
          <ul class="golden-guide-list">
            <li>4월 <strong>890건</strong> vs 6월 <strong>475건</strong> — 6월에도 신호는 많지만 <strong>같은 추세가 아닌 구간</strong>에서 휩쏘(whipsaw) 증가.</li>
            <li>6/8(−8.3%), 6/23(−10%) 등 <strong>급락일 전후</strong> 신호의 익일 수익이 합산을 크게 깎음.</li>
            <li>4월은 월중 최대 낙폭 <strong>−4.5%</strong> 수준으로, “신호 → 익일” 구간이 상대적으로 유리.</li>
          </ul>

          <h4 class="golden-guide-subheading">한 줄 정리</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>질문</th><th>답</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>4월 vs 6월 골든크로스 차이</strong></td>
                <td>4월: <strong>강한 상승장 + 정배열 신호 다수</strong> → 익일 승률·합산 ↑ / 6월: <strong>고점 조정·변동성 + golden 위주 약한 신호</strong> → 익일 승률·합산 ↓</td>
              </tr>
              <tr>
                <td><strong>핵심</strong></td>
                <td>4월 수익은 <strong>KOSPI 대세 상승</strong>과 <strong>추세추종</strong>이 맞물린 결과. 6월은 <strong>지수·변동성·신호 구성</strong> 변화로 같은 규칙에서 <strong>손실 쪽 합산</strong></td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">④ 골든크로스 1일차 성과 — 4월 vs 6월</h3>
          <p class="golden-guide-note">바로 매입 · 추천일(T) 종가 매입 → T+1 종가 매도 · KOSPI TOP 100</p>
          <table class="recommend2-match-table golden-guide-table">
            <thead>
              <tr><th></th><th>4월</th><th>5월</th><th>6월</th></tr>
            </thead>
            <tbody>
              <tr><td>신호 수</td><td>890</td><td>487</td><td>475</td></tr>
              <tr><td><strong>1일차 합산</strong></td><td><strong>+1,045%</strong></td><td>+580%</td><td><strong>−763%</strong></td></tr>
              <tr><td><strong>건당 평균</strong></td><td>+1.17%</td><td>+1.19%</td><td><strong>−1.61%</strong></td></tr>
              <tr><td><strong>익일 승률</strong></td><td><strong>58%</strong></td><td>49%</td><td><strong>33%</strong></td></tr>
              <tr><td>신호일 상승 비율</td><td>68%</td><td>70%</td><td><strong>45%</strong></td></tr>
            </tbody>
          </table>

          <h4 class="golden-guide-subheading">패턴 구성 (4월 vs 6월)</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>패턴</th><th>4월</th><th>6월</th></tr></thead>
            <tbody>
              <tr><td>align (정배열)</td><td>450</td><td>150</td></tr>
              <tr><td>golden (골든만)</td><td>296</td><td>277</td></tr>
              <tr><td>strong</td><td>144</td><td>48</td></tr>
            </tbody>
          </table>

          <ul class="golden-guide-list">
            <li><strong>4월</strong>: 상승장 + align 다수 → 익일 승률 <strong>58%</strong>, 합산 <strong>+1,045%</strong>.</li>
            <li><strong>6월</strong>: 조정·변동성 + golden 위주 → 승률 <strong>33%</strong>, 합산 <strong>−763%</strong>.</li>
            <li><strong>5월</strong>: 4월과 비슷한 상승장이지만 신호 수·합산이 중간 수준(+580%).</li>
          </ul>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">⑤ KOSPI(^KS11) 추이 — 4월 vs 6월</h3>
          <table class="recommend2-match-table golden-guide-table">
            <thead>
              <tr><th>월</th><th>시초 → 월말</th><th>월간 등락</th><th>월중 최대 낙폭</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>2026-04</strong></td><td>5,479 → 6,599</td><td><strong>+20.4%</strong></td><td>−4.5%</td></tr>
              <tr><td><strong>2026-05</strong></td><td>6,937 → 8,476</td><td><strong>+22.2%</strong></td><td>−9.7%</td></tr>
              <tr><td><strong>2026-06</strong></td><td>8,788 → 8,476</td><td><strong>−3.5%</strong></td><td><strong>−15.0%</strong></td></tr>
            </tbody>
          </table>

          <h4 class="golden-guide-subheading">흐름 요약</h4>
          <ul class="golden-guide-list">
            <li><strong>4~5월</strong>: 강한 <strong>상승장</strong> (두 달 합쳐 지수 약 <strong>+50%</strong> 수준).</li>
            <li><strong>6월 초</strong>: 5/29·6/1 부근 <strong>고점 ~8,788</strong> → 이후 <strong>조정·변동성</strong> 구간.</li>
            <li><strong>6월 중순~말</strong>: 급락일 다수 — 6/5 <strong>−5.5%</strong>, 6/8 <strong>−8.3%</strong>, 6/23 <strong>−10%</strong>, 6/26 <strong>−5.8%</strong>, 7/2 <strong>−7.9%</strong>.</li>
            <li>6월은 월말 <strong>−3.5%</strong>지만, 고점 대비 <strong>−15%급</strong> 흔들림이 있는 <strong>횡보·조정장</strong>에 가깝습니다.</li>
          </ul>

          <h4 class="golden-guide-subheading">골든크로스와의 연결</h4>
          <ul class="golden-guide-list">
            <li><strong>4월</strong>: 지수 <strong>+20%</strong> 상승, 낙폭 작음 → 추세추종 <strong>유리</strong>.</li>
            <li><strong>6월</strong>: 고점 대비 <strong>−15%</strong> 조정, 급락일 다수 → 신호 다음날 <strong>하락</strong> 빈도 증가 → 1일차 합산 <strong>마이너스</strong>.</li>
          </ul>
        </section>

        <p class="long-term-guide-caution golden-guide-caution">
          위 %는 <strong>신호별 수익률 단순 합산</strong>이며, 포트폴리오·복리 수익과 다릅니다. Yahoo Finance · KOSPI TOP 100 기준 · 투자 권유 아님.
        </p>
      </article>`;
  }

  window.StockStrategyGoldenGuide = { renderHtml };
})();
