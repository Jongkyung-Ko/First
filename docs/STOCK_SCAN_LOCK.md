# Stock Picks Re 스캔 락 (1단계)

## Supabase

SQL Editor에서 실행:

1. `supabase/stock_scan_jobs.sql`

## 동작

- **전역 1건**: 어떤 추천 방식이든 Re 스캔은 동시에 **1개만** 실행
- **최초 Re**: DM 차감(바닥매집 제외) 후 스캔 시작
- **이후 Re**: 짧은 토스트 「이미 스캔 중」만 (화면 차단 없음, DM 없음)
- **네비·페이지**: 항목별 마지막 갱신 시각 (황금색)

## 폴링·헤더 (v257)

- **상단 헤더** `⟳ API · {서비스명}` + **헤더 아래 배너** 「주식 API 스캔 중…」 — 모든 메뉴에서 즉시 표시
- **같은 브라우저 다른 탭**: Re 시작 시 `localStorage` + `BroadcastChannel`로 **즉시** 동기화 (폴링 전에도 배너 표시)
- **페이지 첫 진입**: `DOMContentLoaded` 직후 meta 1회 + `pageshow`·`focus` 시 즉시 재확인
- **다른 PC/모바일 Re 반영**: 스캔 중 **1.5초** · 대기 **3초**마다 meta 폴링 (v256: 2초/8초)
- `body.stock-api-scanning` — 스캔 중 전역 클래스 (스타일 확장용)
- 툴팁: 마지막 확인 시각·API ms·폴링 주기

- `GET /api/stock-picks/scan/status` — 진행 중 Job
- `GET /api/stock-picks/scan/meta` — Job + 항목별 `lastUpdated`
- `force=true` 요청에 `scan_job_id` (2~4번째 시장) · `Authorization` (DM)

Render **Manual Deploy** 필요.
