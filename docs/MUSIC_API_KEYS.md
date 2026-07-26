# Music API 키 발급 안내

Music 메뉴는 **Jamendo + Openverse** 조합을 사용합니다.  
사이트 **내 스트리밍만** 허용하며, NC(비상업) 라이선스는 제외합니다.

---

## 1. Jamendo Client ID (필수 권장)

재즈·팝·클래식 목록의 **주요 음원**입니다. 키가 없으면 Openverse만 사용합니다.

| 항목 | 내용 |
|------|------|
| 포털 | https://devportal.jamendo.com |
| 문서 | https://developer.jamendo.com/v3.0/docs |
| 비용 | 무료 |

### 발급 순서

1. https://devportal.jamendo.com 접속 → 계정 생성·로그인  
2. **Create application** / **My Apps**에서 앱 등록  
3. 표시되는 **Client ID** 복사 (예: `75ab6c7a`)  
4. OAuth2 authorize 흐름은 **불필요** — `client_id` 쿼리 파라미터만 사용  

> OAuth 문서(https://developer.jamendo.com/v3.0/authentication)는 사용자 로그인용입니다. Music 재생에는 Client ID만 있으면 됩니다.

### Render에 설정

```
JAMENDO_CLIENT_ID=발급받은_Client_ID
```

---

## 2. Openverse (키 불필요)

| 항목 | 내용 |
|------|------|
| API | https://api.openverse.org/v1/audio/ |
| 키 | 없음 |
| 상업 | `license_type=commercial` 필터 사용 |

Jamendo 결과를 **보조**로 채웁니다.

---

## 3. 배포 체크리스트

1. Render → **first-stock-api** → **Environment**  
2. `JAMENDO_CLIENT_ID` 설정  
3. **Save** → 재배포  
4. 사이트 **Music** 메뉴에서 재즈/클래식/팝 확인  

---

## 라이선스 (사이트 내 재생)

- **허용**: Public Domain, CC0, CC BY, CC BY-SA  
- **제외**: CC BY-NC 등 NonCommercial  
- 플레이어에 **출처·라이선스** 표시 (BY 계열)  
- **다운로드 없음** — 스트리밍만  
