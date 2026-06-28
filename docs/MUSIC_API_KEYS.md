# Music API 키 발급 안내

Music 메뉴는 **Jamendo + Openverse + Musopen(선택)** 조합을 사용합니다.  
사이트 **내 스트리밍만** 허용하며, NC(비상업) 라이선스는 제외합니다.

---

## 1. Jamendo Client ID (필수 권장)

재즈·팝·클래식 목록의 **주요 음원**입니다. 키가 없으면 Openverse만 사용합니다.

| 항목 | 내용 |
|------|------|
| 사이트 | https://developer.jamendo.com |
| 비용 | 무료 |
| 상업 | CC 라이선스별 상이 — 앱은 **NC 제외** 필터 적용 |

### 발급 순서

1. https://developer.jamendo.com 접속  
2. 우측 상단 **Sign in** / **Register** → 계정 생성  
3. 로그인 후 **My Apps** (또는 **Applications**) 메뉴  
4. **Create a new application** / **Register your app** 클릭  
5. 앱 이름·설명 입력 (예: `Digital World Music`)  
6. 생성 후 표시되는 **Client ID** 복사  

### Render에 설정

```
JAMENDO_CLIENT_ID=여기에_클라이언트_ID
```

로컬 테스트 (`backend` 폴더):

```cmd
set JAMENDO_CLIENT_ID=여기에_클라이언트_ID
uvicorn main:app --reload
```

---

## 2. Openverse (키 불필요)

| 항목 | 내용 |
|------|------|
| API | https://api.openverse.org/v1/audio/ |
| 키 | **없음** |
| 상업 | `license_type=commercial` 필터 사용 |

Jamendo·Musopen 결과를 **보조**로 채웁니다.

---

## 3. Musopen API Key (선택 — 클래식 보강)

| 항목 | 내용 |
|------|------|
| 사이트 | https://musopen.org |
| 용도 | PD/CC0 클래식 녹음 |
| 키 | **공개 자가발급 포털 없음** — 문의 필요 |

### 요청 순서

1. https://musopen.org/contact/ 접속  
2. **Contact Us** 폼에서 API 키 / 개발용 접근 요청  
3. 승인 후 받은 키를 Render에 설정:

```
MUSOPEN_API_KEY=발급받은_키
```

키가 없어도 **Openverse + Jamendo**로 클래식 탭은 동작합니다.

---

## 4. 배포 체크리스트

1. Render 대시보드 → **first-stock-api** → **Environment**  
2. `JAMENDO_CLIENT_ID` 추가 (권장)  
3. `MUSOPEN_API_KEY` 추가 (선택)  
4. **Save** 후 서비스 재배포  
5. 사이트 Music 메뉴에서 재즈/클래식/팝 목록 확인  

---

## 라이선스 (사이트 내 재생)

- **허용**: Public Domain, CC0, CC BY, CC BY-SA  
- **제외**: CC BY-NC 등 NonCommercial  
- 플레이어에 **출처·라이선스** 표시 (BY 계열)  
- **다운로드 버튼 없음** — 스트리밍만  
