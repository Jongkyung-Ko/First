/**
 * RSI+다이버전스 — 활용 가이드 (정적)
 */
(function () {
  function renderHtml() {
    return `
      <article class="golden-guide-panel" aria-label="RSI 다이버전스 활용 가이드">
        <header class="golden-guide-header">
          <h2 class="golden-guide-title">RSI+다이버전스 · 활용 가이드</h2>
          <p class="golden-guide-lead">RSI(14) 과매도 + 가격 LL·RSI HL · KOSPI TOP 100 · 2026년 4~6월 백테스트 요약</p>
        </header>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">① RSI 다이버전스가 잘 맞는 경우</h3>
          <p>RSI 다이버전스는 <strong>하락·조정 국면에서의 반전(Reversal)</strong> 전략입니다. 가격은 신저가를 갱신하지만 RSI는 고점을 높일 때 <strong>매도 압력 약화</strong>를 읽습니다.</p>

          <h4 class="golden-guide-subheading">하락 추세의 후반·조정 구간</h4>
          <p>장기 하락이 <strong>속도를 늦추고</strong> 바닥을 다지는 구간에서 다이버전스가 가장 의미 있습니다. RSI &lt; 30 과매도와 함께 나올 때 <strong>단기 반등</strong> 확률이 높아집니다.</p>

          <h4 class="golden-guide-subheading">상승장 속 개별 종목 눌림</h4>
          <p>지수는 강세지만 종목만 조정·횡보할 때, 지지 부근에서 RSI 다이버전스가 나오면 <strong>눌림목 매수</strong> 관점과 맞물립니다.</p>

          <h4 class="golden-guide-subheading">횡보·박스권 하단</h4>
          <p>박스권 하단에서 반복적으로 나오는 다이버전스는 <strong>박스 하단 매수</strong> 타이밍으로 활용할 수 있습니다.</p>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">② 잘 맞지 않는 경우 · 주의점</h3>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>환경</th><th>이유</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>강한 일방 하락·패닉</strong></td>
                <td>RSI 과매도·다이버전스가 <strong>연속 발생</strong>해도 바닥이 더 낮아질 수 있음 (칼날 잡기)</td>
              </tr>
              <tr>
                <td><strong>강한 상승 추세</strong></td>
                <td>과매도 구간 자체가 드물어 <strong>신호가 거의 없음</strong> (2026년 4~5월 KOSPI: 신호 0건)</td>
              </tr>
              <tr>
                <td><strong>다이버전스만으로 즉시 매수</strong></td>
                <td>반전 <strong>확인(양봉·거래량)</strong> 없이 진입하면 가짜 신호에 취약</td>
              </tr>
              <tr>
                <td><strong>익일 청산 전제</strong></td>
                <td>앱 성과는 T 종가 → T+1 종가 기준 · <strong>2~3일 추세 보유</strong>와 다를 수 있음</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">③ 결론</h3>
          <p><strong>한 줄 요약</strong> — RSI+다이버전스는 <strong>하락·조정·횡보 하단</strong>에서 반전을 노리는 전략입니다. 2026년 KOSPI TOP 100 기준 <strong>4~5월 신호가 없고 6월에만 3건</strong>이라 월별 비교 표본이 매우 작습니다. 조정·변동성 장(6월)에서야 신호가 잡히지만, 3건 합산 <strong>−3.2%</strong>로 익일 수익만으로는 검증이 어렵습니다.</p>

          <h4 class="golden-guide-subheading">타 전략과의 차이 (6월 KOSPI · 1일차 합산)</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>전략</th><th>6월 성격</th><th>6월 1일차</th></tr></thead>
            <tbody>
              <tr><td>골든크로스</td><td>추세 이어짐 필요</td><td><strong>−763%</strong></td></tr>
              <tr><td>OBV 다이버전스</td><td>매집 다이버전스</td><td><strong>−394.1%</strong></td></tr>
              <tr><td><strong>RSI 다이버전스</strong></td><td>과매도 반전</td><td><strong>−3.2%</strong> (n=3)</td></tr>
              <tr><td>VCP</td><td>수축 후 돌파</td><td><strong>+2.2%</strong></td></tr>
            </tbody>
          </table>
          <p class="golden-guide-note">RSI는 6월 신호 수가 극히 적어 절대값·승률 해석에 한계가 있습니다.</p>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">④ KOSPI TOP 100 · 4~6월 수익률 비교</h3>
          <p class="golden-guide-note">추천일(T) 종가 매입 → 1일차 T+1 종가 · yfinance 6mo 재스캔</p>
          <table class="recommend2-match-table golden-guide-table">
            <thead>
              <tr><th>월</th><th>신호</th><th>1일차 합산</th><th>건당 평균</th><th>승률</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>2026-04</strong></td><td>0</td><td>—</td><td>—</td><td>—</td></tr>
              <tr><td><strong>2026-05</strong></td><td>0</td><td>—</td><td>—</td><td>—</td></tr>
              <tr><td><strong>2026-06</strong></td><td>3</td><td><strong>−3.2%</strong></td><td>−1.07%</td><td>33%</td></tr>
              <tr><td><strong>4~6월 합</strong></td><td>3</td><td><strong>−3.2%</strong></td><td>—</td><td>—</td></tr>
            </tbody>
          </table>

          <h4 class="golden-guide-subheading">같은 기간 타 전략과 비교 (1일차 합산)</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead>
              <tr><th>월</th><th>KOSPI 지수</th><th>RSI 다이버전스</th><th>쌍·삼중바닥</th><th>VCP</th></tr>
            </thead>
            <tbody>
              <tr><td>4월</td><td>+20.4%</td><td>— (n=0)</td><td>+80.6% (n=141)</td><td>+81.8% (n=288)</td></tr>
              <tr><td>5월</td><td>+22.2%</td><td>— (n=0)</td><td>+44.9% (n=34)</td><td>+26.6% (n=38)</td></tr>
              <tr><td>6월</td><td>−3.5%</td><td>−3.2% (n=3)</td><td>−12.3% (n=31)</td><td>+2.2% (n=54)</td></tr>
            </tbody>
          </table>
          <ul class="golden-guide-list">
            <li><strong>4~5월</strong>: KOSPI 강한 상승 → RSI 과매도·다이버전스 조건 <strong>미충족</strong> (신호 0).</li>
            <li><strong>6월</strong>: 조정·변동성에서야 신호 발생 · 표본 3건으로 <strong>통계적 결론은 보류</strong>.</li>
          </ul>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">⑤ KOSPI 장세와의 연결</h3>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>질문</th><th>답</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>어떤 장세에 유리?</strong></td>
                <td><strong>하락·조정·횡보 하단</strong> (강한 상승장에서는 신호 부족)</td>
              </tr>
              <tr>
                <td><strong>4 vs 5 vs 6월</strong></td>
                <td>4·5월 <strong>신호 없음</strong> · 6월만 3건 · 조정장에서 활성화</td>
              </tr>
              <tr>
                <td><strong>주의</strong></td>
                <td>다이버전스 <strong>확인 후 진입</strong> · 일방 하락에서 연속 가짜 신호 · 표본 적음</td>
              </tr>
            </tbody>
          </table>
        </section>

        <p class="long-term-guide-caution golden-guide-caution">
          위 %는 <strong>신호별 수익률 단순 합산</strong>이며, 포트폴리오·복리 수익과 다릅니다. 4~5월 신호 0건 · Yahoo Finance · KOSPI TOP 100 · 투자 권유 아님.
        </p>
      </article>`;
  }

  window.StockStrategyRsiGuide = { renderHtml };
})();
