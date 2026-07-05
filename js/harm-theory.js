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
        <p>아래 <strong>코드 진행 예시</strong>에서 「마디에 적용」 또는 「▶ 들어보기」를 누르면 해당 진행만 마디에 표시됩니다.</p>
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

  const PROGRESSION_DEMOS = [
    {
      id: "pop-1564",
      title: "팝 발라드 I–V–vi–IV",
      key: "C",
      progressionLabel: "C → G → Am → F (4마디)",
      feel: "밝고 서정적 · 팝·발라드 후렴의 정석",
      bpm: 72,
      playStyle: "ballad",
      instrument: "piano",
      chords: [
        { root: "C", quality: "maj" },
        { root: "G", quality: "maj" },
        { root: "A", quality: "min" },
        { root: "F", quality: "maj" }
      ]
    },
    {
      id: "vi-iv-i-v",
      title: "vi–IV–I–V (그리움)",
      key: "C",
      progressionLabel: "Am → F → C → G (4마디)",
      feel: "애절·그리움 · 「내 사랑 내 곁에」류 후렴",
      bpm: 68,
      playStyle: "ballad",
      instrument: "piano",
      chords: [
        { root: "A", quality: "min" },
        { root: "F", quality: "maj" },
        { root: "C", quality: "maj" },
        { root: "G", quality: "maj" }
      ]
    },
    {
      id: "ii-v-i",
      title: "재즈 2–5–1",
      key: "C",
      progressionLabel: "Dm7 → G7 → Cmaj7 → Cmaj7 (4마디)",
      feel: "해결감 · 재즈·스탠다드의 기본 턴어라운드",
      bpm: 100,
      playStyle: "comping",
      instrument: "rhodes",
      chords: [
        { root: "D", quality: "min7" },
        { root: "G", quality: "dom7" },
        { root: "C", quality: "maj7" },
        { root: "C", quality: "maj7" }
      ]
    },
    {
      id: "i-vi-ii-v",
      title: "I–vi–ii–V (50년대)",
      key: "C",
      progressionLabel: "C → Am → Dm → G7 (4마디)",
      feel: "회전감 · 올드팝·뮤지컬 스타일",
      bpm: 108,
      playStyle: "stride",
      instrument: "piano",
      chords: [
        { root: "C", quality: "maj" },
        { root: "A", quality: "min" },
        { root: "D", quality: "min" },
        { root: "G", quality: "dom7" }
      ]
    },
    {
      id: "canon",
      title: "카논형 I–V–vi–iii–IV",
      key: "C",
      progressionLabel: "C → G → Am → Em → F (5마디)",
      feel: "서정·전개 · Pachelbel 카anon형 진행",
      bpm: 70,
      playStyle: "alberti",
      instrument: "piano",
      chords: [
        { root: "C", quality: "maj" },
        { root: "G", quality: "maj" },
        { root: "A", quality: "min" },
        { root: "E", quality: "min" },
        { root: "F", quality: "maj" }
      ]
    },
    {
      id: "andalusian",
      title: "안달루시아 진행",
      key: "Am",
      progressionLabel: "Am → G → F → E7 (4마디)",
      feel: "비장·이별 · 플라멩코·한국 발라드 브릿지",
      bpm: 66,
      playStyle: "guitar",
      instrument: "guitar_nylon",
      chords: [
        { root: "A", quality: "min" },
        { root: "G", quality: "maj" },
        { root: "F", quality: "maj" },
        { root: "E", quality: "dom7" }
      ]
    },
    {
      id: "turnaround-8",
      title: "8마디 턴어라운드",
      key: "C",
      progressionLabel: "C Am7 Dm7 G7 | Em7 Am7 Dm7 G7 (8마디)",
      feel: "재즈·보사 브릿지 · 마지막 G7에서 다시 I로",
      bpm: 96,
      playStyle: "bossa",
      instrument: "guitar_nylon",
      chords: [
        { root: "C", quality: "maj7" },
        { root: "A", quality: "min7" },
        { root: "D", quality: "min7" },
        { root: "G", quality: "dom7" },
        { root: "E", quality: "min7" },
        { root: "A", quality: "min7" },
        { root: "D", quality: "min7" },
        { root: "G", quality: "dom7" }
      ]
    },
    {
      id: "gospel-plagal",
      title: "갸스펠 IV–I 종지",
      key: "C",
      progressionLabel: "F → F → C → G (4마디)",
      feel: "웅장·해결 · plagal(4→1) + V 마무리",
      bpm: 74,
      playStyle: "gospel",
      instrument: "organ",
      chords: [
        { root: "F", quality: "maj" },
        { root: "F", quality: "maj7" },
        { root: "C", quality: "maj" },
        { root: "G", quality: "dom7" }
      ]
    }
  ];

  ];

  /** 작곡 기초 5단계 (화성 이론 섹션 위에 표시) */
  const COMPOSE_BASICS_STEPS = [
    {
      id: "basics-step1",
      title: "1단계: 화성학의 첫걸음",
      summary: "기초 체력 — 음이름·온음·반음·음정·장음계",
      body: `
        <p>코드(화음)를 배우기 전, 악보와 소리의 가장 기본적인 단위를 이해하는 단계입니다.</p>
        <h4>음이름과 계이름</h4>
        <ul>
          <li><strong>영문 음이름</strong> · C – D – E – F – G – A – B (국제적으로 악보·코드 표기에 사용)</li>
          <li><strong>계이름(독음)</strong> · 도 – 레 – 미 – 파 – 솔 – 라 – 시 (한국·독일식 독창에 익숙)</li>
          <li>같은 소리, 다른 이름: C = 도, D = 레 … Harm 코드 편집은 영문, 이론 설명은 둘 다 병기하면 편합니다.</li>
        </ul>
        <h4>온음과 반음</h4>
        <ul>
          <li><strong>반음(Half step)</strong> · 피아노에서 바로 옆 검은·흰 건반 (예: E→F, B→C). 가장 작은 거리.</li>
          <li><strong>온음(Whole step)</strong> · 반음 두 개 (예: C→D, F→G).</li>
          <li>기억법: 흰 건반만 보면 E–F, B–C 사이에만 ‘반음 간격’이 바로 붙어 있습니다.</li>
        </ul>
        <h4>음정 (Interval)</h4>
        <p>두 음 사이의 거리. 이름만 익혀도 코드·멜로디 감각이 빨라집니다.</p>
        <ul>
          <li><strong>완전음정</strong> · 1도(동음), 4·5·8도 — 안정·공명 (완전1·4·5·8)</li>
          <li><strong>장음정</strong> · 2·3·6·7도 — Major 스케일에서의 밝은 간격 (장2·장3·장6·장7)</li>
          <li><strong>단음정</strong> · Minor 쪽으로 한 반음 좁아진 3·6·7도 — 슬픔·긴장 (단3·단6·단7)</li>
        </ul>
        <p>직관: <em>C에서 E까지</em>는 장3도(밝음), <em>C에서 E♭까지</em>는 단3도(어두움). 이 차이가 Major vs Minor의 핵심입니다.</p>
        <h4>장음계 (Major Scale)</h4>
        <ul>
          <li>패턴: <strong>온–온–반–온–온–온–반</strong> (3↔4음, 7↔8음 사이가 반음)</li>
          <li>도레미파솔라시도 = C Major. 다른 루트에서 같은 패턴을 쌓으면 12개 키(Key)가 됩니다.</li>
          <li>♯·♭ 조표는 ‘이 조에서 반음이 어디에 모이는가’를 악보에 미리 알려 주는 표시입니다.</li>
        </ul>
        <p><strong>아래 12개 장음계</strong>를 눌러 소리를 들어 보세요. 조마다 밝기·무게·곡 분위기가 조금씩 다릅니다.</p>
        <div data-harm-scale-explorer></div>
      `
    },
    {
      id: "basics-step2",
      title: "2단계: 삼화음",
      summary: "Triad — Major·Minor·Dim·Aug, 다이아토닉, 전위",
      body: `
        <p>소리가 3개 겹쳐진 <strong>삼화음(Triad)</strong>을 마스터하면 대중음악 반주의 80% 이상을 다룰 수 있습니다.</p>
        <h4>Major vs Minor</h4>
        <ul>
          <li><strong>Major(장삼화음)</strong> · 근음 + 장3도 + 완전5도 — 밝고 안정 (C–E–G)</li>
          <li><strong>Minor(단삼화음)</strong> · 근음 + 단3도 + 완전5도 — 슬프고 서정 (A–C–E)</li>
          <li>3음(가운데 음)이 반음만 내려가도 분위기가 완전히 바뀝니다.</li>
        </ul>
        <h4>Diminished & Augmented</h4>
        <ul>
          <li><strong>Dim(감삼화음)</strong> · 단3 + 감5 — 불안·전환·긴장 (B–D–F)</li>
          <li><strong>Aug(증삼화음)</strong> · 장3 + 증5 — 몽환·부유감, 짧게 쓰면 색채 (C–E–G#)</li>
        </ul>
        <h4>다이아토닉 코드 (Diatonic Chords)</h4>
        <p>한 Major 키(예: C) 안에서 자연스럽게 나오는 7가지 ‘가족’ 코드:</p>
        <ul>
          <li>I C · ii Dm · iii Em · IV F · V G · vi Am · vii° Bdim</li>
          <li>대문자=Major, 소문자=minor, °=dim. 대부분의 팝·발라드는 이 7개 안에서 움직입니다.</li>
        </ul>
        <h4>코드의 자리바꿈 (Inversion)</h4>
        <ul>
          <li>근음을 위로 올려 3음·5음을 아래에 두면 <strong>1전위·2전위</strong> — 같은 코드, 다른 ‘색’.</li>
          <li>코드 간 음 이동을 최소화하면 <strong>보이스 리딩</strong> — Harm 재생 시 자동으로 비슷한 원리를 적용합니다.</li>
        </ul>
      `
    },
    {
      id: "basics-step3",
      title: "3단계: 곡의 뼈대 만들기",
      summary: "코드 진행·기능 — 토닉·도미넌트·II-V-I·Money Chords",
      body: `
        <p>코드를 어떻게 배치해야 ‘노래 같은 흐름’이 생기는지 배우는 <strong>작곡의 핵심</strong> 단계입니다.</p>
        <h4>주요 3화음과 역할</h4>
        <ul>
          <li><strong>토닉(Tonic, I)</strong> · ‘집’ — 안정·시작·끝 (C, Am 등)</li>
          <li><strong>서브도미넌트(Subdominant, IV·ii)</strong> · ‘다리’ — 전개·이동 (F, Dm)</li>
          <li><strong>도미넌트(Dominant, V)</strong> · ‘모험’ — 긴장 후 I로 해결 (G, G7)</li>
        </ul>
        <h4>II–V–I (투–파이브–원)</h4>
        <ul>
          <li><strong>Dm7 → G7 → Cmaj7</strong> · 재즈·스탠다드의 기본 마법. ‘돌아온다’는 느낌이 강함.</li>
          <li>팝에서도 브릿지·코드 마무리에 변형해 자주 등장합니다.</li>
        </ul>
        <h4>Money Chords (히트곡 제조기)</h4>
        <ul>
          <li><strong>I – V – vi – IV</strong> · C – G – Am – F — 팝·K-POP·발라드 후렴의 정석</li>
          <li><strong>vi – IV – I – V</strong> · Am – F – C – G — 더 그리운 후렴 (「내 사랑 내 곁에」류)</li>
          <li>귀에 꽂히는 이유: 토닉↔도미넌트 긴장과 vi의 서정이 반복·대비를 만듭니다.</li>
        </ul>
        <p>Harm 아래 <strong>화성·코드 진행</strong> 탭의 예시에서 「▶ 들어보기」로 바로 들어 보세요.</p>
      `
    },
    {
      id: "basics-step4",
      title: "4단계: 사화음과 세련된 소리",
      summary: "7th·텐션·Sus4·Add9 — R&B·재즈·시티팝",
      body: `
        <p>소리를 4개 이상으로 늘려 풍성하고 감성적인 R&B, 재즈, 시티팝 느낌을 내는 단계입니다.</p>
        <h4>7화음 (7th Chords)</h4>
        <ul>
          <li><strong>Maj7</strong> · Cmaj7 (C–E–G–B) — 부드럽고 ‘재즈·시티팝’ 색</li>
          <li><strong>Dominant7</strong> · G7 (G–B–D–F) — 긴장, 다음 코드로 밀어줌</li>
          <li><strong>Min7</strong> · Dm7 — 재즈 ii, 발라드 서정</li>
        </ul>
        <h4>텐션 (9, 11, 13)</h4>
        <ul>
          <li>기본 7th 위에 <strong>9·11·13</strong>을 얹은 ‘양념’ — 같은 코드지만 훨씬 풍성</li>
          <li>실전: G13, Cmaj9, Dm9 등. Harm에서는 dom7·maj7·min7 타입으로 시작하면 충분합니다.</li>
        </ul>
        <h4>Sus4 & Add9</h4>
        <ul>
          <li><strong>Sus4</strong> · 3도 대신 4도 — ‘매달린’ 전주·빌드업 (Csus4 → C)</li>
          <li><strong>Add9</strong> · 9도만 추가, 7th 없음 — 팝·가요 전주의 예쁜 코드 (Cadd9)</li>
        </ul>
      `
    },
    {
      id: "basics-step5",
      title: "5단계: 실전 응용",
      summary: "멜로디+화성·세컨더리 도미넌트·조바꿈",
      body: `
        <p>이론을 넘어 실제 멜로디에 화성을 붙이고 곡을 발전시키는 단계입니다.</p>
        <h4>멜로디에 코드 붙이기</h4>
        <ul>
          <li>흥얼거린 멜로디 음이 <strong>어느 스케일·코드톤</strong>에 해당하는지 보면 코드 후보가 좁혀집니다.</li>
          <li>마디 첫 박·강세에 근음·3·5가 맞는 코드를 먼저 시도 → Harm에서 마디별로 바꿔 들으며 조정.</li>
        </ul>
        <h4>세컨더리 도미넌트 (Secondary Dominant)</h4>
        <ul>
          <li>원래 키 밖의 <strong>V7</strong>를 잠깐 넣어 ‘다음 코드로 강하게 끌어당김’ (예: C조에서 D7 → G → C)</li>
          <li>다이아토닉만 쓰던 진행에 <strong>짜릿한 반전</strong>·서프라이즈 브릿지에 효과적.</li>
        </ul>
        <h4>조바꿈 (Modulation)</h4>
        <ul>
          <li>후렴·클라이맥스에서 <strong>반음~온음 올려</strong> 에너지 극대화 (예: G → A♭, C → D)</li>
          <li>Harm 상단 <strong>조 ±</strong> 버튼으로 전체 코드·멜로디를 함께 이동해 ‘키 업’ 느낌을 미리 들어 볼 수 있습니다.</li>
        </ul>
        <p>프리셋 불러오기 → 멜로디 ON → +4마디로 확장 → 저장. 이 흐름으로 1~4단계를 Harm에서 바로 실험해 보세요.</p>
      `
    }
  ];

  /** 12 Major 키 — 1단계 음계 듣기용 */
  const MAJOR_SCALE_KEYS = [
    { id: "C", root: "C", label: "C Major (다장조)", solfege: "도레미파솔라시도", feel: "맑고 순수 · 피아노 기본, 동요·밝은 발라드" },
    { id: "Db", root: "Db", label: "D♭ Major (라♭장조)", solfege: "라♭ 시♭ 도♭ 레♭ …", feel: "몽환·영화음악 · Misty·낭만적 재즈" },
    { id: "D", root: "D", label: "D Major (라장조)", solfege: "라 시 도# 레 …", feel: "밝고 화사 · 기타·록·어쿠스틱 팝" },
    { id: "Eb", root: "Eb", label: "E♭ Major (마♭장조)", solfege: "마♭ 라♭ 시♭ …", feel: "웅장·재즈 · 색소폰·스탠다드(E♭)의 대표" },
    { id: "E", root: "E", label: "E Major (마장조)", solfege: "마 파# 솔# …", feel: "강렬·록 · 기타 오픈코드, 에너지 높은 후렴" },
    { id: "F", root: "F", label: "F Major (바장조)", solfege: "바 도 레 …", feel: "따뜻·포근 · 포크·어쿠스틱, ‘비의 랩소디’류" },
    { id: "Gb", root: "Gb", label: "G♭ Major (사♭장조)", solfege: "사♭ 라♭ …", feel: "은은·신비 · 6개♭, 드물지만 독특한 색" },
    { id: "G", root: "G", label: "G Major (사장조)", solfege: "사 라# 시 …", feel: "친근·대중적 · 기타 G키, 캠프파이어·팝" },
    { id: "Ab", root: "Ab", label: "A♭ Major (가♭장조)", solfege: "가♭ 시♭ …", feel: "부드럽·고급 · R&B·발라드, ‘사랑은 늘 도망가’ 키" },
    { id: "A", root: "A", label: "A Major (가장조)", solfege: "가 나# 다 …", feel: "밝고 힘찬 · A·E 기타, 어쿠스틱·컨트리" },
    { id: "Bb", root: "Bb", label: "B♭ Major (내♭장조)", solfege: "내♭ 다 레 …", feel: "재즈·브라스 · 트럼펫·색소폰 스탠다드" },
    { id: "B", root: "B", label: "B Major (나장조)", solfege: "나 다# 레# …", feel: "날카롭·현대 · 5개♯, 밝지만 긴장감 있는 팝" }
  ];

  const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11, 12];

  function buildScaleExplorerHtml() {
    const cards = MAJOR_SCALE_KEYS.map(
      (k) => `
        <article class="harm-scale-card">
          <div class="harm-scale-card-head">
            <strong>${k.label}</strong>
            <button type="button" class="harm-btn harm-btn-ghost harm-scale-play" data-harm-scale-play="${k.root}" title="${k.root} Major 들어보기">▶</button>
          </div>
          <p class="harm-scale-solfege">${k.solfege}</p>
          <p class="harm-scale-feel">${k.feel}</p>
        </article>`
    ).join("");
    return `<div class="harm-scale-grid">${cards}</div>`;
  }

  window.HarmTheory = {
    TABS: THEORY_TABS,
    PROGRESSION_DEMOS,
    COMPOSE_BASICS_STEPS,
    MAJOR_SCALE_KEYS,
    MAJOR_SCALE_INTERVALS,
    buildScaleExplorerHtml
  };
})();
