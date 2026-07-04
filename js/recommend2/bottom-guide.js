/**
 * 바닥매집 — 활용 가이드 (정적)
 */
(function () {
  function renderHtml() {
    return `
      <article class="golden-guide-panel" aria-label="바닥매집 활용 가이드">
        <header class="golden-guide-header">
          <h2 class="golden-guide-title">바닥매집 · 활용 가이드</h2>
          <p class="golden-guide-lead">거래량 매집 + SMA5 패턴 A/B · KOSPI TOP 100 · 2026년 4~6월 백테스트 요약</p>
        </header>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">① 바닥매집이 잘 맞는 경우 (승률·익일 수익이 높은 환경)</h3>
          <p>바닥매집은 <strong>추세 추종이 아니라</strong>, 단기 약세 구간에서 <strong>거래량이 단계적으로 늘 때</strong> 포착하는 <strong>단기 반등·스윙</strong> 전략입니다.</p>

          <h4 class="golden-guide-subheading">신호 조건 (앱 로직)</h4>
          <ul class="golden-guide-list">
            <li>T-2·T-1 <strong>거래량 전일 대비 +10%~+30%</strong> 연속 2일</li>
            <li><strong>패턴 A</strong>: SMA5 등락률 2일 연속 하락 (약세 중 매집)</li>
            <li><strong>패턴 B</strong>: SMA5 T-2 하락 → T-1 상승 전환 (바닥에서 꺾임)</li>
            <li><strong>매입</strong>: 신호일(T-1) <strong>종가</strong> · <strong>1일차</strong> = 다음 거래일 종가 수익</li>
          </ul>

          <h4 class="golden-guide-subheading">유리한 장세 — 상승 후 눌림·조정·변동성</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>환경</th><th>왜 유리한가</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>상승 국면 속 개별 종목 눌림</strong></td>
                <td>지수는 올라도 종목별 조정·횡보가 잦고, SMA5 약세 + 거래량 증가 패턴이 자주 발생 (2026년 4~5월)</td>
              </tr>
              <tr>
                <td><strong>상승 후 조정·변동성 장</strong></td>
                <td>급락 다음 <strong>짧은 기술적 반등</strong>이 많아 <strong>익일(1일차)</strong> 수익과 잘 맞음 (2026년 6월 KOSPI)</td>
              </tr>
              <tr>
                <td><strong>조용한 매집 구간</strong></td>
                <td>거래량 +10~30%는 패닉 매도(+50%↑)가 아닌 <strong>단계적 포지션 축적</strong>과 가깝다</td>
              </tr>
            </tbody>
          </table>
          <p class="golden-guide-note">「순수 횡보 박스권만」이 아닙니다. 4~5월은 KOSPI <strong>+20%대 강한 상승</strong>이었는데도 바닥매집 1일차는 <strong>플러스</strong>였습니다.</p>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">② 바닥매집이 잘 맞지 않는 경우 (승률이 낮은 환경)</h3>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>환경</th><th>이유</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>장기 하락·패닉 장</strong></td>
                <td>거래량은 늘지만 <strong>분산 매도</strong>일 수 있음 → 가짜 매집, 데드캣 바운스 후 재하락</td>
              </tr>
              <tr>
                <td><strong>눌림 없는 일방 상승</strong></td>
                <td>SMA5가 계속 강하면 <strong>신호 자체가 적음</strong></td>
              </tr>
              <tr>
                <td><strong>2~3일 이상 추세 보유</strong></td>
                <td>6월 KOSPI: 1일차 +49.3% vs <strong>2일차 +6.1%</strong> → 익일 반등은 맞아도 그다음 날 이익 유지 어려움</td>
              </tr>
              <tr>
                <td><strong>시장별 차이</strong></td>
                <td>KOSDAQ 2026년 4·6월은 1일차 <strong>마이너스</strong> — KOSPI와 동일하지 않음</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">③ 결론 — 바닥매집을 어떻게 이해할 것인가?</h3>
          <p><strong>한 줄 요약</strong> — 바닥매집은 「횡보장 전용」이 아니라, <strong>상승(또는 고점) 이후 단기 눌림·조정·변동성</strong> 구간에서 <strong>거래량 매집 → 익일 반등</strong>을 노리는 전략입니다. <strong>6월처럼 추세 추종·밴드 전략이 깨지는 장</strong>에서는 <strong>상대적으로 유리</strong>할 수 있습니다.</p>

          <h4 class="golden-guide-subheading">골든크로스·볼린저와의 차이 (2026년 6월 KOSPI · 1일차 합산)</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>전략</th><th>6월 성격</th><th>6월 1일차</th></tr></thead>
            <tbody>
              <tr><td>골든크로스</td><td>추세 <strong>이어짐</strong> 필요</td><td><strong>−763%</strong></td></tr>
              <tr><td>볼린저밴드</td><td>밴드 <strong>왕복·돌파</strong></td><td><strong>−258.8%</strong></td></tr>
              <tr><td><strong>바닥매집</strong></td><td><strong>약세 중 매집 → 익일 반등</strong></td><td><strong>+49.3%</strong></td></tr>
            </tbody>
          </table>

          <ul class="golden-guide-list">
            <li><strong>4~5월</strong>: 대세 상승 + 종목별 눌림 → 4~6월 내내 1일차 플러스, 승률 <strong>62~69%</strong> 유지.</li>
            <li><strong>6월</strong>: 지수 <strong>−3.5%</strong>(고점 대비 −15%) 조정·급락·반등 반복 → 골든/볼린저는 손실 합산, 바닥매집은 <strong>1일차 최고</strong>(+49.3%).</li>
            <li><strong>2일차</strong>: 6월 <strong>+6.1%</strong>로 약함 → <strong>단기 스윙·익일 청산</strong> 관점에 가깝습니다.</li>
          </ul>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">④ KOSPI TOP 100 · 4~6월 수익률 비교</h3>
          <p class="golden-guide-note">추천일(T-1) 종가 매입 → 1일차 T+1 종가 · 2일차 T+2 종가 · yfinance 6mo 재스캔</p>

          <h4 class="golden-guide-subheading">월별 성과 (바닥매집)</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead>
              <tr><th>월</th><th>신호</th><th>1일차 합산</th><th>건당 평균</th><th>승률</th><th>2일차 합산</th><th>패턴 A/B</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>2026-04</strong></td><td>13</td><td><strong>+18.5%</strong></td><td>+1.43%</td><td><strong>69%</strong></td><td>+25.4%</td><td>11 / 2</td></tr>
              <tr><td><strong>2026-05</strong></td><td>19</td><td><strong>+31.9%</strong></td><td>+1.68%</td><td>63%</td><td><strong>+37.4%</strong></td><td>17 / 2</td></tr>
              <tr><td><strong>2026-06</strong></td><td>16</td><td><strong>+49.3%</strong></td><td><strong>+3.08%</strong></td><td>62%</td><td>+6.1%</td><td>12 / 4</td></tr>
              <tr><td><strong>4~6월 합</strong></td><td>48</td><td><strong>+99.7%</strong></td><td>—</td><td>—</td><td><strong>+68.9%</strong></td><td>—</td></tr>
            </tbody>
          </table>

          <ul class="golden-guide-list">
            <li><strong>4월</strong>: 합산은 작지만 <strong>승률 69%</strong>로 가장 안정적.</li>
            <li><strong>5월</strong>: <strong>2일차 +37.4%</strong>로 2일 보유 관점에서 양호.</li>
            <li><strong>6월</strong>: <strong>1일차 최고</strong>이나 <strong>2일차 +6.1%</strong> → 익일 반등 후 힘 빠짐.</li>
          </ul>

          <h4 class="golden-guide-subheading">같은 기간 타 전략과 비교 (KOSPI · 바로 매입 · 1일차 합산)</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead>
              <tr><th>월</th><th>KOSPI 지수</th><th>바닥매집</th><th>골든크로스</th><th>볼린저밴드</th></tr>
            </thead>
            <tbody>
              <tr><td>4월</td><td>+20.4%</td><td><strong>+18.5%</strong> (n=13)</td><td>+1,045% (n=890)</td><td>+102.6% (n=319)</td></tr>
              <tr><td>5월</td><td>+22.2%</td><td><strong>+31.9%</strong> (n=19)</td><td>+580% (n=487)</td><td>+279.0% (n=273)</td></tr>
              <tr><td>6월</td><td>−3.5%</td><td><strong>+49.3%</strong> (n=16)</td><td>−763% (n=475)</td><td>−258.8% (n=312)</td></tr>
            </tbody>
          </table>
          <p class="golden-guide-note">골든·볼린저 합산은 신호 건수가 많아 절대값 비교는 어렵습니다. <strong>6월 방향(±)</strong> 비교가 의미 있습니다.</p>
        </section>

        <section class="golden-guide-section">
          <h3 class="golden-guide-heading">⑤ KOSDAQ 참고 · KOSPI 장세 연결</h3>

          <h4 class="golden-guide-subheading">KOSDAQ TOP 100 (시장별로 다름)</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>월</th><th>신호</th><th>1일차 합산</th><th>승률</th><th>2일차 합산</th></tr></thead>
            <tbody>
              <tr><td>4월</td><td>20</td><td><strong>−24.7%</strong></td><td>30%</td><td>−30.8%</td></tr>
              <tr><td>5월</td><td>18</td><td><strong>+51.4%</strong></td><td>56%</td><td>+65.1%</td></tr>
              <tr><td>6월</td><td>14</td><td><strong>−18.7%</strong></td><td>36%</td><td>+1.4%</td></tr>
            </tbody>
          </table>

          <h4 class="golden-guide-subheading">한 줄 정리</h4>
          <table class="recommend2-match-table golden-guide-table">
            <thead><tr><th>질문</th><th>답</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>어떤 장세에 유리?</strong></td>
                <td>상승 후 <strong>눌림·조정·변동성</strong> (순수 횡보만은 아님)</td>
              </tr>
              <tr>
                <td><strong>4 vs 5 vs 6월</strong></td>
                <td><strong>세 달 모두 1일차 플러스</strong> · 6월 1일차 최고 · 6월 2일차 약함</td>
              </tr>
              <tr>
                <td><strong>6월에 왜 골든/볼린저와 다름?</strong></td>
                <td>추세·밴드 실패 구간에서 <strong>단기 매집→반등</strong>이 상대적으로 유리</td>
              </tr>
              <tr>
                <td><strong>한계</strong></td>
                <td>익일 이후 약함 · KOSDAQ 4·6월 마이너스 · 신호 수 적음(월 13~19건)</td>
              </tr>
            </tbody>
          </table>
        </section>

        <p class="long-term-guide-caution golden-guide-caution">
          위 %는 <strong>신호별 수익률 단순 합산</strong>이며, 포트폴리오·복리 수익과 다릅니다. Yahoo Finance · KOSPI TOP 100 · 6mo 재스캔 기준 · 투자 권유 아님.
        </p>
      </article>`;
  }

  window.Recommend2BottomGuide = { renderHtml };
})();
