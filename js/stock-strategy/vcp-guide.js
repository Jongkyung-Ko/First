/**
 * VCP — 활용 가이드 (정적)
 */
(function () {
  function renderHtml() {
    return `
      <article class="golden-guide-panel" aria-label="VCP 활용 가이드">
        <header class="golden-guide-header">
          <h2 class="golden-guide-title">VCP · 활용 가이드</h2>
          <p class="golden-guide-lead">변동성·거래량 수축 + 피벗 돌파 · KOSPI TOP 100 · 2026년 4~6월 백테스트 요약</p>
        </header>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">① VCP가 잘 맞는 경우</h3>
          <p>VCP(Volatility Contraction Pattern)는 <strong>고점 대비 조정 → 변동폭·거래량 수축 → 피벗 돌파</strong>를 노리는 <strong>추세·돌파</strong> 전략입니다.</p>

          <h4 class="golden-guide-subheading">상승 추세 속 건강한 조정 (Base)</h4>
          <p>강한 상승 후 8~35% 눌림, 변동폭이 30→20→10일로 <strong>단계적 수축</strong>할 때 돌파 신뢰도가 높습니다. 2026년 4월: 신호 288건 · 합산 <strong>+81.8%</strong>.</p>

          <h4 class="golden-guide-subheading">거래량 건조(Dry-up) 후 돌파</h4>
          <p>수축 구간에서 거래량이 줄고, 돌파일 <strong>1.25배 이상</strong> 증가하면 기관 매집 후 돌파로 해석됩니다.</p>

          <h4 class="golden-guide-subheading">조정·변동성 장 (6월)</h4>
          <p>6월 KOSPI 조정에서도 VCP 1일차 합산 <strong>+2.2%</strong>, 승률 <strong>48%</strong> — 골든·OBV·볼린저와 달리 <strong>플러스 유지</strong>. 수축·돌파는 <strong>방향 없는 횡보</strong>보다 <strong>베이스 형성 후 돌파</strong> 구간에 강합니다.</p>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">② 잘 맞지 않는 경우 · 주의점</h3>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>환경</th><th>이유</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>장기 하락·바닥 없음</strong></td>
                <td>고점 대비 조정이 <strong>추세 반전</strong>이면 수축 후에도 재하락</td>
              </tr>
              <tr>
                <td><strong>수축만·돌파 없음</strong></td>
                <td>앱은 <strong>수축 관찰</strong>과 <strong>피벗 돌파</strong> 모두 신호 — 돌파 전 진입은 시간 낭비</td>
              </tr>
              <tr>
                <td><strong>5월 신호 급감</strong></td>
                <td>5월 n=38 (4월 288) — <strong>일방 상승</strong>만 이어지면 베이스·수축 패턴 부족</td>
              </tr>
              <tr>
                <td><strong>가짜 돌파</strong></td>
                <td>거래량 없는 돌파 · 고점 대비 −35% 이상 깊은 조정은 <strong>베이스 품질</strong> 의심</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">③ 결론</h3>
          <p><strong>한 줄 요약</strong> — VCP는 <strong>상승 추세 속 조정·수축 후 돌파</strong>에 최적입니다. 2026년 KOSPI는 <strong>4·5·6월 모두 1일차 플러스</strong>(+81.8% / +26.6% / +2.2%)로, 6월 조정장에서 <strong>골든·볼린저·OBV와 대비되는 상대 강세</strong>입니다. 4~6월 합산 <strong>+110.6%</strong>은 쌍·삼중바닥(+113.1%)과 유사합니다.</p>

          <h4 class="golden-guide-subheading">6월 타 전략 비교 (1일차 합산)</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>전략</th><th>6월 1일차</th><th>6월 승률</th></tr></thead>
            <tbody>
              <tr><td>골든크로스</td><td>−763%</td><td>33%</td></tr>
              <tr><td>볼린저밴드</td><td>−258.8%</td><td>—</td></tr>
              <tr><td>OBV 다이버전스</td><td>−394.1%</td><td>38%</td></tr>
              <tr><td><strong>VCP</strong></td><td><strong>+2.2%</strong></td><td><strong>48%</strong></td></tr>
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
              <tr><td><strong>2026-04</strong></td><td>288</td><td><strong>+81.8%</strong></td><td>+0.28%</td><td>49%</td></tr>
              <tr><td><strong>2026-05</strong></td><td>38</td><td><strong>+26.6%</strong></td><td>+0.70%</td><td>42%</td></tr>
              <tr><td><strong>2026-06</strong></td><td>54</td><td><strong>+2.2%</strong></td><td>+0.04%</td><td>48%</td></tr>
              <tr><td><strong>4~6월 합</strong></td><td>380</td><td><strong>+110.6%</strong></td><td>—</td><td>—</td></tr>
            </tbody>
          </table>

          <h4 class="golden-guide-subheading">KOSPI 지수와 비교</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead>
              <tr><th>월</th><th>KOSPI 월간</th><th>VCP 1일차</th><th>해석</th></tr>
            </thead>
            <tbody>
              <tr><td>4월</td><td>+20.4%</td><td>+81.8%</td><td>강한 상승 · 베이스·돌파 다수</td></tr>
              <tr><td>5월</td><td>+22.2%</td><td>+26.6%</td><td>신호↓ · 건당↑</td></tr>
              <tr><td>6월</td><td>−3.5%</td><td>+2.2%</td><td>조정장에서도 플러스 유지</td></tr>
            </tbody>
          </table>

          <h4 class="golden-guide-subheading">전략 간 4~6월 방향 비교</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead>
              <tr><th>전략</th><th>4월</th><th>5월</th><th>6월</th><th>4~6월 합</th></tr>
            </thead>
            <tbody>
              <tr><td>골든크로스</td><td>+1,045%</td><td>+580%</td><td>−763%</td><td>—</td></tr>
              <tr><td>볼린저</td><td>+102.6%</td><td>+279%</td><td>−258.8%</td><td>+122.8%</td></tr>
              <tr><td><strong>VCP</strong></td><td>+81.8%</td><td>+26.6%</td><td><strong>+2.2%</strong></td><td><strong>+110.6%</strong></td></tr>
              <tr><td>쌍·삼중바닥</td><td>+80.6%</td><td>+44.9%</td><td>−12.3%</td><td>+113.1%</td></tr>
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
                <td><strong>상승 추세 속 조정·수축</strong> · 돌파 직전/직후 (순수 횡보만은 아님)</td>
              </tr>
              <tr>
                <td><strong>주의</strong></td>
                <td>수축만으로 매수 X · 가짜 돌파 · 5월처럼 베이스 없으면 신호 급감</td>
              </tr>
              <tr>
                <td><strong>4 vs 5 vs 6월</strong></td>
                <td><strong>세 달 모두 +</strong> · 4월 신호·합산 최대 · 6월 <strong>조정장 상대 강세</strong></td>
              </tr>
            </tbody>
          </table>
        </section>

        <p class="long-term-guide-caution golden-guide-caution">
          위 %는 <strong>신호별 수익률 단순 합산</strong>이며, 포트폴리오·복리 수익과 다릅니다. Yahoo Finance · KOSPI TOP 100 · 투자 권유 아님.
        </p>
      </article>`;
  }

  window.StockStrategyVcpGuide = { renderHtml };
})();
