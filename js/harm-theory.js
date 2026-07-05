(function () {
  "use strict";

  const THEORY_TABS = [
    {
      id: "progression",
      title: "화성·코드 진행",
      summary: "자주 쓰는 진행과 기능",
      body: `
        <p>코드 진행은 <strong>긴장(Tension)</strong>과 <strong>해결(Resolution)</strong>의 흐름입니다. 마디마다 코드를 바꿀 때, 앞 코드에서 다음 코드로 ‘이어지는 느낌’을 만드는 것이 핵심입니다.</p>
        <h4>대표 진행</h4>
        <ul>
          <li><strong>I – V – vi – IV</strong> (C – G – Am – F) · 팝·발라드에서 가장 흔함. 밝고 서정적.</li>
          <li><strong>vi – IV – I – V</strong> (Am – F – C – G) · 「내 사랑 내 곁에」류 후렴. 약간 더 그리움.</li>
          <li><strong>ii – V – I</strong> (Dm7 – G7 – Cmaj7) · 재즈의 기본. 2-5-1은 ‘돌아온다’는 느낌이 강함.</li>
          <li><strong>I – vi – ii – V</strong> · 1950년대 스탠다드, 회전감 있는 진행.</li>
        </ul>
        <h4>코드 타입 역할</h4>
        <ul>
          <li><strong>Major / Maj7</strong> · 안정, 밝음, ‘집’ 같은 느낌 (I)</li>
          <li><strong>Minor / Min7</strong> · 어두움, 서정, 때로는 ii·vi 기능</li>
          <li><strong>Dominant 7</strong> · 긴장, 다음 코드로 밀어줌 (V7)</li>
          <li><strong>m7♭5</strong> · 반감·불안, 재즈 iiø (반감ii)에 자주 등장</li>
          <li><strong>Sus4 / Sus2</strong> · 3도를 미루어 ‘매달린’ 느낌, 전환용</li>
        </ul>
        <p>Harm에서 코드를 바꿀 때는 <em>한 마디에 하나</em> 또는 <em>0.5마디</em> 단위로 두고, 후렴은 짧은 루프(4코드)를 반복하면 기억하기 쉽습니다.</p>
      `
    },
    {
      id: "keys",
      title: "음계·조의 느낌",
      summary: "Major / Minor와 조성",
      body: `
        <p>같은 코드 진행이라도 <strong>조(Key)</strong>에 따라 전체 분위기가 달라집니다. Harm 프리셋의 Key 표시를 참고하세요.</p>
        <h4>Major (장조)</h4>
        <ul>
          <li><strong>C, F, G, B♭</strong> · 밝고 직설적. 발라드·팝 후렴.</li>
          <li><strong>D, A, E</strong> · 기타·록에 잘 어울리는 밝은 톤.</li>
          <li>느낌: 희망, 확신, ‘해피엔딩’에 가깝게.</li>
        </ul>
        <h4>Minor (단조)</h4>
        <ul>
          <li><strong>Am, Em, Dm</strong> · 한국 발라드·서정곡의 중심. 그리움·애절.</li>
          <li><strong>Gm, Fm</strong> · 더 무겁거나 재즈·블루스 쪽.</li>
          <li>느낌: 그리움, 내면, 밤·비·이별 이미지.</li>
        </ul>
        <h4>재즈에서 자주 쓰는 조</h4>
        <ul>
          <li><strong>E♭, B♭</strong> · 색소폰·피아노 스탠다드(Misty 등)에 흔함.</li>
          <li><strong>Modal (So What 등)</strong> · 한 코드를 길게 유지, ‘공간’과 ‘색’ 강조.</li>
        </ul>
        <p>작곡 팁: verse는 <strong>minor·7th</strong>로 깊이를 주고, chorus는 <strong>major·IV–V</strong>로 열어 주면 대비가 큽니다.</p>
      `
    },
    {
      id: "structure",
      title: "작곡·곡 구조",
      summary: "Intro ~ Outro 패턴",
      body: `
        <p>48마디 프리셋은 대략 아래 구조를 따릅니다. 직접 작곡할 때도 같은 틀을 쓰면 됩니다.</p>
        <h4>일반적인 32~48마디 구조</h4>
        <ol>
          <li><strong>Intro (4마디)</strong> · 후렴 코드 또는 마지막 4코드만. 분위기 제시.</li>
          <li><strong>Verse (8마디)</strong> · 스토리·낮은 에너지. vi·ii·IV 위주.</li>
          <li><strong>Chorus (8마디)</strong> · 후킹. I–V–vi–IV 또는 곡의 대표 루프.</li>
          <li><strong>Verse 2 (8마디)</strong> · 1절과 같은 진행 또는 살짝 변형.</li>
          <li><strong>Chorus (8마디)</strong> · 반복.</li>
          <li><strong>Bridge / Outro (4~8마디)</strong> · IV–V–vi·V turnaround 후 마무리.</li>
        </ol>
        <h4>재즈 스탠다드</h4>
        <ul>
          <li><strong>AABA</strong> · 32마디(8×4). A는 같은 진행, B(Bridge)만 다른 조·진행.</li>
          <li><strong>Turnaround</strong> · 마지막 2마디를 ii–V–I로 돌려 다음 chorus로 연결.</li>
          <li><strong>Take Five</strong> · 5/4 박자. Harm에서 박자 5/4 선택 후 재즈 프리셋 참고.</li>
        </ul>
        <h4>Harm 활용</h4>
        <ul>
          <li>기본 16마디로 시작 → <strong>+4마디 추가</strong>로 후렴·브릿지 확장.</li>
          <li>프리셋 불러온 뒤 마디별 코드만 바꿔 ‘나만의 변주’ 만들기.</li>
          <li>저장 목록에 이름 붙여 verse/chorus 버전을 나눠 보관.</li>
        </ul>
      `
    },
    {
      id: "tips",
      title: "실전 작곡 팁",
      summary: "Harm에서 바로 써먹기",
      body: `
        <ul>
          <li><strong>보이스 리딩</strong> · Harm 재생 시 자동으로 코드 간 음 이동을 최소화합니다. 같은 조 안에서 전위만 바꿔도 전문적으로 들립니다.</li>
          <li><strong>베이스 ON</strong> · 루트·5도·3도 워킹으로 리듬감. 발라드·재즈 모두 추천.</li>
          <li><strong>연주 스타일</strong> · 발라드 아르페지오, 알베르티, 갸스펠, 왈츠, 재즈 컴핑, 스트라이드, 보사노바, 12/8 셔플 등 11가지.</li>
          <li><strong>반주 악기</strong> · SoundFont 실제 샘플 16종 (피아노·Rhodes·오르간·현악·기타·비브라폰·마림바·아코디언 등).</li>
          <li><strong>드럼 장르</strong> · 발라드 preset → ballad, 재즈 → jazz, 보사 → bossa/latin 자동 추천.</li>
          <li><strong>BPM</strong> · 발라드 60–74, 재즈 스윙 100–140, 발라드 재즈(Misty) 58–80.</li>
        </ul>
        <p>코드는 ‘맞는 것’보다 <strong>반복·대비·해결</strong>이 중요합니다. 4마디 루프를 먼저 만족스럽게 만든 뒤, Harm에서 길이만 늘려 보세요.</p>
      `
    }
  ];

  window.HarmTheory = { TABS: THEORY_TABS };
})();
