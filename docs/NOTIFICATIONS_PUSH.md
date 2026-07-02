# Stock Picks Web Push 알림

## Supabase

SQL Editor에서 실행:

1. `supabase/push_subscriptions.sql`

## Render 환경 변수

VAPID 키 생성:

```bash
cd backend
pip install pywebpush
python ../scripts/generate_vapid_keys.py
```

Render **first-stock-api** 에 추가:

| 변수 | 설명 |
|------|------|
| `VAPID_PUBLIC_KEY` | 공개키 (URL-safe base64) |
| `VAPID_PRIVATE_KEY` | 비밀키 |
| `VAPID_SUBJECT` | `mailto:your@email.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | 구독 저장·발송용 (이미 있으면 생략) |

배포 후 Manual Deploy.

## 동작

- **한국장**: GitHub Actions `record_kr` 후 `/api/notifications/cron/digest?region=kr`
- **미국장**: `record_us` 후 `region=us`
- **앱 테스트**: 추천공식 → 알림 카드 → 「지금 테스트 발송」
- **DM**: 한국·미국 각각 켤 때 **1 DM** (`spendForStockNotification`)

## API

- `GET /api/notifications/vapid-public-key`
- `GET /api/notifications/status` (Bearer JWT)
- `POST /api/notifications/subscribe` (Bearer JWT)
- `PATCH /api/notifications/preferences` (Bearer JWT)
- `POST /api/notifications/test?region=kr|us` (Bearer JWT)
- `POST /api/notifications/cron/digest?region=kr|us` (Bearer `CRON_SECRET`)
