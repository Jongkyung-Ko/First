# Stock Picks Re 스캔 락 (1단계)

## Supabase

SQL Editor에서 실행:

1. `supabase/stock_scan_jobs.sql`

## 동작

- **전역 1건**: 어떤 추천 방식이든 Re 스캔은 동시에 **1개만** 실행
- **최초 Re**: DM 차감(바닥매집 제외) 후 스캔 시작
- **이후 Re**: 짧은 토스트 「이미 스캔 중」만 (화면 차단 없음, DM 없음)
- **네비·페이지**: 항목별 마지막 갱신 시각 (황금색)

## 폴링·헤더 (v256)

- **상단 헤더** `⟳ API · {서비스명}` — Render 주식 API 스캔 중 전역 표시 (모든 메뉴)
- **페이지 첫 진입**: `DOMContentLoaded` 직후 `/api/stock-picks/scan/meta` 1회 즉시 호출 + API 왕복 시간(보통 0.3~3초)
- **다른 PC/모바일 Re 반영**: 스캔 중 **2초** · 대기 **8초**마다 meta 폴링 (이전 idle 30초)
- 툴팁: 마지막 확인 시각·API ms·폴링 주기

- `GET /api/stock-picks/scan/status` — 진행 중 Job
- `GET /api/stock-picks/scan/meta` — Job + 항목별 `lastUpdated`
- `force=true` 요청에 `scan_job_id` (2~4번째 시장) · `Authorization` (DM)

Render **Manual Deploy** 필요.
