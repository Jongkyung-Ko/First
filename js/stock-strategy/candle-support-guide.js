/**
 * 지지+반전캔들 — 활용 가이드 (정적)
 */
(function () {
  function renderHtml() {
    return `
      <article class="golden-guide-panel" aria-label="지지 반전캔들 활용 가이드">
        <header class="golden-guide-header">
          <h2 class="golden-guide-title">지지+반전캔들 · 활용 가이드</h2>
          <p class="golden-guide-lead">SMA20·SMA60·20일 저점 지지 + 망치·샛별·장악 · KOSPI TOP 100 · 2026년 4~6월</p>
        </header>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">① 지지+반전캔들이 잘 맞는 경우</h3>
          <p>이 전략은 <strong>지지선 근처에서 캔들 반전</strong>을 포착하는 <strong>단기 스윙·반등</strong> 전략입니다.</p>

          <h4 class="golden-guide-subheading">상승 추세 속 눌림·조정</h4>
          <p>대세 상승 중 SMA20·SMA60 지지에서 망치·장악형이 나오면 <strong>눌림목 매수</strong>와 잘 맞습니다. 2026년 4월 KOSPI: 1일차 합산 <strong>+31.3%</strong>, 승률 <strong>52%</strong>.</p>

          <h4 class="golden-guide-subheading">횡보·박스권 하단</h4>
          <p>20일 저점·이동평균이 <strong>수평 지지</strong>로 작동할 때 반전 캔들의 신뢰도가 높습니다.</p>

          <h4 class="golden-guide-subheading">조정 초기·변동성 장</h4>
          <p>고점 대비 조정 구간에서 지지 터치 + 반전 캔들은 <strong>기술적 반등</strong> 타이밍으로 쓰일 수 있습니다. 6월은 합산 <strong>−10.6%</strong>이지만 승률 <strong>44%</strong>로 5월(28%)보다 나음.</p>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">② 잘 맞지 않는 경우 · 주의점</h3>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>환경</th><th>이유</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>지지선 붕괴·하락 추세</strong></td>
                <td>지지 터치 후 <strong>음봉 연속</strong>이면 망치·장악은 <strong>함정</strong> (2026년 5월: 합산 <strong>−109.3%</strong>)</td>
              </tr>
              <tr>
                <td><strong>강한 상승만 이어질 때</strong></td>
                <td>지지까지 <strong>눌리지 않으면</strong> 신호 자체가 적음</td>
              </tr>
              <tr>
                <td><strong>지지선 과다 겹침</strong></td>
                <td>SMA20·60·20일 저점 중 <strong>하나만</strong> 맞아도 신호 → 약한 지지에서도 발생</td>
              </tr>
              <tr>
                <td><strong>거래량 미확인</strong></td>
                <td>반전 캔들에 <strong>거래량 동반</strong> 없으면 가짜 반등 가능</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">③ 결론</h3>
          <p><strong>한 줄 요약</strong> — 지지+반전캔들은 <strong>상승·횡보 속 지지 구간</strong>에서 유리합니다. 2026년 KOSPI는 <strong>4월 플러스 → 5월 큰 마이너스 → 6월 소폭 마이너스</strong>로, 5월 강한 상승장 속에도 <strong>지지 실패·가짜 반전</strong>이 많았습니다(승률 28%). 6월 조정장에서는 오히려 5월보다 나은 승률(44%)이지만 합산은 여전히 마이너스입니다.</p>

          <h4 class="golden-guide-subheading">타 전략 비교 (6월 · 1일차 합산)</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>전략</th><th>6월 1일차</th><th>6월 승률</th></tr></thead>
            <tbody>
              <tr><td>골든크로스</td><td>−763%</td><td>33%</td></tr>
              <tr><td>OBV 다이버전스</td><td>−394.1%</td><td>38%</td></tr>
              <tr><td><strong>지지+반전캔들</strong></td><td><strong>−10.6%</strong></td><td><strong>44%</strong></td></tr>
              <tr><td>VCP</td><td>+2.2%</td><td>48%</td></tr>
              <tr><td>바닥매집</td><td>+49.3%</td><td>62%</td></tr>
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
              <tr><td><strong>2026-04</strong></td><td>67</td><td><strong>+31.3%</strong></td><td>+0.47%</td><td><strong>52%</strong></td></tr>
              <tr><td><strong>2026-05</strong></td><td>87</td><td><strong>−109.3%</strong></td><td>−1.26%</td><td>28%</td></tr>
              <tr><td><strong>2026-06</strong></td><td>73</td><td><strong>−10.6%</strong></td><td>−0.14%</td><td>44%</td></tr>
              <tr><td><strong>4~6월 합</strong></td><td>227</td><td><strong>−88.6%</strong></td><td>—</td><td>—</td></tr>
            </tbody>
          </table>

          <h4 class="golden-guide-subheading">KOSPI 지수와 비교</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead>
              <tr><th>월</th><th>KOSPI 월간</th><th>지지+반전캔들 1일차</th><th>해석</th></tr>
            </thead>
            <tbody>
              <tr><td>4월</td><td>+20.4%</td><td>+31.3%</td><td>상승장 눌림목 — 지지 반등 유리</td></tr>
              <tr><td>5월</td><td>+22.2%</td><td>−109.3%</td><td>지수↑에도 지지 실패·가짜 반전 다수</td></tr>
              <tr><td>6월</td><td>−3.5%</td><td>−10.6%</td><td>조정·변동성 — 지지 붕괴 후 재시도</td></tr>
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
                <td><strong>상승 추세 눌림</strong> · 횡보 하단 · 조정 초기 (지지가 살아 있을 때)</td>
              </tr>
              <tr>
                <td><strong>주의</strong></td>
                <td>지수 상승 ≠ 지지 성공 · <strong>5월처럼 지수↑·전략↓</strong> 가능 · 거래량 확인</td>
              </tr>
              <tr>
                <td><strong>4 vs 5 vs 6월</strong></td>
                <td>4월 <strong>+</strong> · 5월 <strong>큰 −</strong> · 6월 <strong>소폭 −</strong> (승률은 6월 &gt; 5월)</td>
              </tr>
            </tbody>
          </table>
        </section>

        <p class="long-term-guide-caution golden-guide-caution">
          위 %는 <strong>신호별 수익률 단순 합산</strong>이며, 포트폴리오·복리 수익과 다릅니다. Yahoo Finance · KOSPI TOP 100 · 투자 권유 아님.
        </p>
      </article>`;
  }

  window.StockStrategyCandleSupportGuide = { renderHtml };
})();
