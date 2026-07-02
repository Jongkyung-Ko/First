# Stock Picks Re 스캔 락 (1단계)

## Supabase

SQL Editor에서 실행:

1. `supabase/stock_scan_jobs.sql`

## 동작

- **전역 1건**: 어떤 추천 방식이든 Re 스캔은 동시에 **1개만** 실행
- **최초 Re**: DM 차감(바닥매집 제외) 후 스캔 시작
- **이후 Re**: `409` · 「이미 스캔 중입니다」·진행 상황만 표시 (DM 없음)
- **네비·페이지**: 항목별 마지막 갱신 시각 (황금색)

## API

- `GET /api/stock-picks/scan/status` — 진행 중 Job
- `GET /api/stock-picks/scan/meta` — Job + 항목별 `lastUpdated`
- `force=true` 요청에 `scan_job_id` (2~4번째 시장) · `Authorization` (DM)

Render **Manual Deploy** 필요.
