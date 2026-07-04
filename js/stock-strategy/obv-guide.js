/**
 * OBV+다이버전스 — 활용 가이드 (정적)
 */
(function () {
  function renderHtml() {
    return `
      <article class="golden-guide-panel" aria-label="OBV 다이버전스 활용 가이드">
        <header class="golden-guide-header">
          <h2 class="golden-guide-title">OBV+다이버전스 · 활용 가이드</h2>
          <p class="golden-guide-lead">가격 LL · OBV HL 매집 다이버전스 · KOSPI TOP 100 · 2026년 4~6월 백테스트 요약</p>
        </header>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">① OBV 다이버전스가 잘 맞는 경우</h3>
          <p>OBV 다이버전스는 가격은 신저가인데 <strong>거래량 누적(OBV)은 고점을 높일 때</strong> — 즉 <strong>조용한 매집</strong>을 읽는 반전 전략입니다.</p>

          <h4 class="golden-guide-subheading">하락·조정 후반 — 매집 구간</h4>
          <p>하락세가 둔화되고 기관·큰손이 <strong>분할 매수</strong>할 때 OBV HL이 자주 나타납니다. 2026년 4월: 합산 <strong>+91.8%</strong>, 5월 <strong>+66.8%</strong>.</p>

          <h4 class="golden-guide-subheading">횡보·박스권 하단</h4>
          <p>박스 하단에서 가격만 흔들리고 OBV는 올라가면 <strong>박스 이탈 상승</strong> 전조로 해석할 수 있습니다.</p>

          <h4 class="golden-guide-subheading">상승장 속 개별 종목 조정</h4>
          <p>지수는 강세지만 종목만 눌릴 때, OBV 다이버전스는 <strong>종목별 바닥 매집</strong> 신호로 활용됩니다.</p>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">② 잘 맞지 않는 경우 · 주의점</h3>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>환경</th><th>이유</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>급락·패닉 매도</strong></td>
                <td>거래량 급증이 <strong>매도</strong>일 수 있음 → OBV HL이 <strong>가짜 매집</strong></td>
              </tr>
              <tr>
                <td><strong>변동성·조정장 (6월)</strong></td>
                <td>신호 <strong>354건</strong> · 합산 <strong>−394.1%</strong> — 다이버전스 남발·익일 하락</td>
              </tr>
              <tr>
                <td><strong>신호 과다</strong></td>
                <td>OBV는 RSI보다 신호가 많음 · <strong>품질 필터</strong>(추세·거래량) 없으면 휩쏘</td>
              </tr>
              <tr>
                <td><strong>익일 청산 전제</strong></td>
                <td>매집은 <strong>수일~수주</strong> 걸릴 수 있음 · 앱 1일차와 시간 축 불일치</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">③ 결론</h3>
          <p><strong>한 줄 요약</strong> — OBV 다이버전스는 <strong>하락·조정·횡보에서 매집</strong>을 노립니다. 2026년 KOSPI는 <strong>4~5월 플러스 → 6월 대규모 마이너스</strong>로 골든크로스·볼린저와 비슷한 <strong>장세 의존</strong> 패턴입니다. 6월 신호 수(354)가 4월(194)의 약 1.8배인데 합산은 <strong>−394%</strong> — <strong>조정·급락일 전후 가짜 다이버전스</strong> 증가가 원인입니다.</p>

          <h4 class="golden-guide-subheading">타 전략 비교 (6월 · 1일차 합산)</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>전략</th><th>6월 신호</th><th>6월 1일차</th></tr></thead>
            <tbody>
              <tr><td>골든크로스</td><td>475</td><td>−763%</td></tr>
              <tr><td>볼린저밴드</td><td>312</td><td>−258.8%</td></tr>
              <tr><td><strong>OBV 다이버전스</strong></td><td><strong>354</strong></td><td><strong>−394.1%</strong></td></tr>
              <tr><td>바닥매집</td><td>16</td><td>+49.3%</td></tr>
            </tbody>
          </table>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">④ KOSPI TOP 100 · 4~6월 수익률 비교</h3>
          <p class="golden-guide-note">추천일(T) 종가 매입 → 1일차 T+1 종가 · yfinance 6mo 재스캔</p>
          <table class="recommend2-match-table golden-guide-table">
            <thead>
              <tr><th>월</th><th>신호</th><th>1일차 합산</th><th>건당 평균</th><th>승률</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>2026-04</strong></td><td>194</td><td><strong>+91.8%</strong></td><td>+0.47%</td><td>48%</td></tr>
              <tr><td><strong>2026-05</strong></td><td>134</td><td><strong>+66.8%</strong></td><td>+0.50%</td><td>43%</td></tr>
              <tr><td><strong>2026-06</strong></td><td>354</td><td><strong>−394.1%</strong></td><td>−1.11%</td><td>38%</td></tr>
              <tr><td><strong>4~6월 합</strong></td><td>682</td><td><strong>−235.5%</strong></td><td>—</td><td>—</td></tr>
            </tbody>
          </table>

          <h4 class="golden-guide-subheading">KOSPI 지수와 비교</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead>
              <tr><th>월</th><th>KOSPI 월간</th><th>OBV 1일차</th><th>해석</th></tr>
            </thead>
            <tbody>
              <tr><td>4월</td><td>+20.4%</td><td>+91.8%</td><td>상승·눌림 — 매집 다이버전스 유리</td></tr>
              <tr><td>5월</td><td>+22.2%</td><td>+66.8%</td><td>강한 상승 지속</td></tr>
              <tr><td>6월</td><td>−3.5%</td><td>−394.1%</td><td>조정·급락 — 가짜 매집·신호 폭증</td></tr>
            </tbody>
          </table>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">⑤ 한 줄 정리</h3>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>질문</th><th>답</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>유리한 장세</strong></td>
                <td><strong>하락·조정 후반</strong> · 횡보 매집 · 상승장 속 종목 눌림</td>
              </tr>
              <tr>
                <td><strong>주의</strong></td>
                <td>6월처럼 <strong>신호↑·수익↓</strong> · 패닉 구간 가짜 HL · 익일 청산과 매집 시간축 차이</td>
              </tr>
              <tr>
                <td><strong>4 vs 5 vs 6월</strong></td>
                <td>4·5월 <strong>플러스</strong> · 6월 <strong>−394%</strong> (골든·볼린저급 장세 리스크)</td>
              </tr>
            </tbody>
          </table>
        </section>

        <p class="long-term-guide-caution golden-guide-caution">
          위 %는 <strong>신호별 수익률 단순 합산</strong>이며, 포트폴리오·복리 수익과 다릅니다. Yahoo Finance · KOSPI TOP 100 · 투자 권유 아님.
        </p>
      </article>`;
  }

  window.StockStrategyObvGuide = { renderHtml };
})();
