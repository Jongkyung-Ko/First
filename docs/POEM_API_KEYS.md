# Poem — 공유마당 API 키

Poem 페이지는 **한국저작권위원회 공유(만료)저작물** Open API를 Render 백엔드에서 프록시합니다.

## 발급

1. [공공데이터포털 — 공유(만료)저작물 서비스](https://www.data.go.kr/data/15000497/openapi.do) 활용 신청
2. **일반 인증키(Decoding)** 복사

## Render 환경 변수

| 변수 | 설명 |
|------|------|
| `GONGU_SERVICE_KEY` | 공공데이터포털 인증키 (권장) |
| `GONGU_API_KEY` | 위와 동일 (별칭) |

설정 후 Render 서비스를 재배포하면 `/api/poem/works`, `/api/poem/work/{id}` 가 동작합니다.

## API 엔드포인트 (참고)

공유마당 ShrWrtgService는 **`http://openapi.copyright.or.kr`** (HTTP)만 지원합니다. HTTPS(443)는 연결 거부됩니다.  
백엔드 `poem_service.py`가 자동으로 HTTP를 사용합니다.

## 출처 표기

UI에 **공유마당 · 한국저작권위원회** 출처를 표시합니다. 만료저작물은 별도 허락 없이 이용 가능하나, 출처 표시는 권장됩니다.

## 트래픽

개발 키 기준 **일 1,000건**. 서버에서 목록·본문을 캐시합니다.
