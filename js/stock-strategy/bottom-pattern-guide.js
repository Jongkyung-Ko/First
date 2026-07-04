/**
 * 쌍·삼중바닥 — 활용 가이드 (정적)
 */
(function () {
  function renderHtml() {
    return `
      <article class="golden-guide-panel" aria-label="쌍삼중바닥 활용 가이드">
        <header class="golden-guide-header">
          <h2 class="golden-guide-title">쌍·삼중바닥 · 활용 가이드</h2>
          <p class="golden-guide-lead">유사 저점 2~3회 + 넥라인 돌파 · KOSPI TOP 100 · 2026년 4~6월 백테스트 요약</p>
        </header>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">① 쌍·삼중바닥이 잘 맞는 경우</h3>
          <p>쌍·삼중바닥은 <strong>바닥 형성 후 넥라인 돌파</strong>로 추세 전환을 확인하는 <strong>차트 패턴·반전</strong> 전략입니다.</p>

          <h4 class="golden-guide-subheading">하락 후 바닥 다지기 구간</h4>
          <p>유사 저점을 2~3번 테스트하고 넥라인을 돌파할 때 <strong>중기 반등</strong> 신호로 해석됩니다. 2026년 4월: 합산 <strong>+80.6%</strong>, 승률 <strong>55%</strong>(4~6월 중 최고).</p>

          <h4 class="golden-guide-subheading">횡보·박스권 상단 돌파</h4>
          <p>박스권에서 쌍바닥 + 넥라인 돌파는 <strong>박스 이탈 상승</strong>과 겹칩니다.</p>

          <h4 class="golden-guide-subheading">상승 전환 초기</h4>
          <p>대세 하락이 멈추고 <strong>W자·3바닥</strong> 형성 후 돌파 시, 추세 추종 매수와 맞물릴 수 있습니다. 5월: 신호 34건 · 합산 <strong>+44.9%</strong> · 건당 평균 <strong>+1.32%</strong>(4~6월 최고).</p>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">② 잘 맞지 않는 경우 · 주의점</h3>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>환경</th><th>이유</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>가짜 돌파 (False Breakout)</strong></td>
                <td>넥라인 돌파 후 <strong>다시 하락</strong> — 6월 합산 <strong>−12.3%</strong></td>
              </tr>
              <tr>
                <td><strong>강한 상승만 이어질 때</strong></td>
                <td>바닥 패턴 형성 전에 이미 상승 → <strong>신호 감소</strong> (5월 n=34 vs 4월 n=141)</td>
              </tr>
              <tr>
                <td><strong>저점 유사도 ±3% 느슨함</strong></td>
                <td>앱 로직상 <strong>유사 바닥</strong> 판정이 넓어 약한 패턴도 포함</td>
              </tr>
              <tr>
                <td><strong>익일 청산 vs 패턴 보유</strong></td>
                <td>넥라인 돌파 후 <strong>수일~수주</strong> 상승이 일반적 · 1일차만 보면 과소/과대 평가</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">③ 결론</h3>
          <p><strong>한 줄 요약</strong> — 쌍·삼중바닥은 <strong>하락·횡보 후 바닥 확인·돌파</strong> 전략입니다. 2026년 KOSPI는 <strong>4~5월 플러스 → 6월 소폭 마이너스</strong>로, 4~6월 합산 <strong>+113.1%</strong>은 VCP(+110.6%)와 비슷한 <strong>중간 수준</strong>입니다. 6월 조정장에서도 골든(−763%)·OBV(−394%)보다 <strong>손실 폭이 작음</strong>(−12.3%).</p>

          <h4 class="golden-guide-subheading">타 전략 비교 (6월 · 1일차 합산)</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>전략</th><th>6월 1일차</th><th>4~6월 합</th></tr></thead>
            <tbody>
              <tr><td>골든크로스</td><td>−763%</td><td>—</td></tr>
              <tr><td>볼린저밴드</td><td>−258.8%</td><td>+122.8%</td></tr>
              <tr><td><strong>쌍·삼중바닥</strong></td><td><strong>−12.3%</strong></td><td><strong>+113.1%</strong></td></tr>
              <tr><td>VCP</td><td>+2.2%</td><td>+110.6%</td></tr>
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
              <tr><td><strong>2026-04</strong></td><td>141</td><td><strong>+80.6%</strong></td><td>+0.57%</td><td><strong>55%</strong></td></tr>
              <tr><td><strong>2026-05</strong></td><td>34</td><td><strong>+44.9%</strong></td><td><strong>+1.32%</strong></td><td>41%</td></tr>
              <tr><td><strong>2026-06</strong></td><td>31</td><td><strong>−12.3%</strong></td><td>−0.40%</td><td>42%</td></tr>
              <tr><td><strong>4~6월 합</strong></td><td>206</td><td><strong>+113.1%</strong></td><td>—</td><td>—</td></tr>
            </tbody>
          </table>

          <h4 class="golden-guide-subheading">KOSPI 지수와 비교</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead>
              <tr><th>월</th><th>KOSPI 월간</th><th>쌍·삼중바닥 1일차</th><th>해석</th></tr>
            </thead>
            <tbody>
              <tr><td>4월</td><td>+20.4%</td><td>+80.6%</td><td>상승 전환·바닥 돌파 다수</td></tr>
              <tr><td>5월</td><td>+22.2%</td><td>+44.9%</td><td>신호↓ · 건당 수익↑</td></tr>
              <tr><td>6월</td><td>−3.5%</td><td>−12.3%</td><td>가짜 돌파 · 조정</td></tr>
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
                <td><strong>하락 후 바닥</strong> · 횡보 돌파 · 상승 전환 초기</td>
              </tr>
              <tr>
                <td><strong>주의</strong></td>
                <td>가짜 넥라인 돌파 · 패턴 완성 전 조기 진입 · 1일차 ≠ 패턴 목표 수익</td>
              </tr>
              <tr>
                <td><strong>4 vs 5 vs 6월</strong></td>
                <td>4월 <strong>신호·승률 최고</strong> · 5월 <strong>건당 최고</strong> · 6월 <strong>소폭 −</strong></td>
              </tr>
            </tbody>
          </table>
        </section>

        <p class="long-term-guide-caution golden-guide-caution">
          위 %는 <strong>신호별 수익률 단순 합산</strong>이며, 포트폴리오·복리 수익과 다릅니다. Yahoo Finance · KOSPI TOP 100 · 투자 권유 아님.
        </p>
      </article>`;
  }

  window.StockStrategyBottomPatternGuide = { renderHtml };
})();
