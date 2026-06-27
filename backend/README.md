# First Stock API (yfinance)

FastAPI backend that aggregates Yahoo Finance headlines via [yfinance](https://pypi.org/project/yfinance/).

## Local run

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Test: http://localhost:8000/api/headlines?market=all

## Deploy on Render

**One-click (after this repo is on GitHub):**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Jongkyung-Ko/First)

Or manually:

1. Sign up at https://dashboard.render.com/register (GitHub login).
2. **New +** → **Blueprint** → connect the `First` repository (uses [`render.yaml`](../render.yaml) at repo root).
3. Service name will be **`first-stock-api`** → URL: `https://first-stock-api.onrender.com`
4. [`js/config.js`](../js/config.js) is already set to that URL for production.

### Environment variables (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `HEADLINES_CACHE_TTL` | `600` | Cache seconds per market |
| `CORS_ORIGINS` | (built-in) | Extra comma-separated origins |
| `SUPABASE_URL` | — | Supabase project URL (prediction history) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Service role key for prediction writes |
| `CRON_SECRET` | — | Bearer token for `/api/predictions/*` cron endpoints |
| `GOOGLE_TTS_API_KEY` | — | Google Cloud Text-to-Speech API key (Books Neural2) |
| `FREETTS_API_KEY` | — | FreeTTS PRO API key (optional; raises limits) |
| `GOOGLE_TTS_MONTHLY_LIMIT` | `1000000` | Google TTS monthly cap tracked on server |
| `FREETTS_TTS_MONTHLY_LIMIT` | `5000` (free) / `1000000` (with key) | FreeTTS monthly cap |
| `FREETTS_TTS_HOURLY_LIMIT` | `1000` (free) / `0` (with key, no server cap) | FreeTTS hourly cap per server |
| `FREETTS_TTS_MAX_CHARS` | `1000` | Max chars per FreeTTS request |
| `GOOGLE_TTS_MAX_CHARS` | `4500` | Max chars per Google TTS request |

### TTS engines (Books listen)

| Engine | Env vars | Limits (free, no key) |
|--------|----------|------------------------|
| FreeTTS | optional `FREETTS_API_KEY` | **1,000 chars/hour** + 5K/month per **server IP** |
| Cloud TTS Neural2 | `GOOGLE_TTS_API_KEY` | Per Google Cloud billing |
| Browser TTS (Web Speech) | — | Client-side only; no server env vars |

**Important:** On Render, all users share one outbound IP. FreeTTS free tier exhausts quickly for Books. Use **Google Neural2** for real listening, or set `FREETTS_API_KEY` (PRO plan).

`POST /api/books/tts` accepts `{ "engine": "freetts"|"google", "text": "...", "voice": "...", "rate": "1.0" }`.

See [Books TTS setup](#books-tts-setup) below.

GitHub repository secrets for [`.github/workflows/stock-predictions.yml`](../.github/workflows/stock-predictions.yml):

| Secret | Value |
|--------|--------|
| `STOCK_API_URL` | `https://first-stock-api.onrender.com` |
| `CRON_SECRET` | Same value as Render `CRON_SECRET` |

Run [`supabase/stock_pick_predictions.sql`](../supabase/stock_pick_predictions.sql) in Supabase SQL Editor before first cron run.

## Endpoints

- `GET /api/headlines?market=all|kr|us&lang=ko|original&limit=40` — headline feed (`lang=ko` translates titles to Korean)
- `GET /api/recommendations?market=kr_kospi|kr_kosdaq|us&lang=ko&limit=10` — live picks (local dev / fallback)
- `GET /api/chart?ticker=005930.KS&period=3mo&interval=1d` — OHLCV chart data
- `GET /api/predictions/history?ticker=005930.KS&market=kr_kospi&days=30` — prediction accuracy history
- `GET /api/predictions/summary?market=kr_kospi&days=30` — per-ticker 7d/30d accuracy
- `POST /api/predictions/record?market=kr|us` — cron: save morning predictions (Bearer `CRON_SECRET`)
- `POST /api/predictions/finalize?market=kr|us` — cron: score vs same-day close (Bearer `CRON_SECRET`)
- `POST /api/predictions/backfill?market=all|kr|us&days=30` — one-time close-only rows for recent trading days (Bearer `CRON_SECRET`)
- `GET /api/books/speech/status` — TTS engines, config, monthly usage
- `POST /api/books/translate` — translate book chunk (`{ "text": "...", "target": "ko" }`)
- `POST /api/books/tts` — TTS (`engine`: `freetts` or `google`) → `audio/mpeg`
- `GET /api/gutenberg/themes` — curated theme collections (Shakespeare, classics, etc.)
- `GET /api/gutenberg/books` — PD book catalog (`theme` param for curated lists)
- `GET /api/gutenberg/text/{book_id}` — plain-text book body
- `GET /health` — health check

## Books TTS setup

### 1. Deploy backend (required for all engines)

1. Push code to GitHub `main`.
2. Render → `first-stock-api` → **Manual Deploy → Deploy latest commit**.
3. Confirm: `https://first-stock-api.onrender.com/health` → `{"ok":true}`.

### 2. FreeTTS (no API key)

Works immediately after Render deploy. The server proxies `https://freetts.org/api`.

- **Without API key:** 1,000 characters **per hour** and 5,000/month per **server IP** (all users on Render share this quota).
- **With `FREETTS_API_KEY`:** PRO limits (set `FREETTS_TTS_MONTHLY_LIMIT`, etc.).

Optional Render env:

| Variable | Default (no key) | Purpose |
|----------|------------------|---------|
| `FREETTS_API_KEY` | — | FreeTTS PRO API key from freetts.org dashboard |
| `FREETTS_TTS_HOURLY_LIMIT` | `1000` | Server-side hourly cap |
| `FREETTS_TTS_MONTHLY_LIMIT` | `5000` | Server-side monthly cap |
| `FREETTS_TTS_MAX_CHARS` | `1000` | Per-request cap |

### 3. Google Cloud TTS Neural2

1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Create or select a project.
3. **Billing** → link a billing account (required for Cloud TTS; free tier still needs billing).
4. **APIs & Services → Library** → enable **Cloud Text-to-Speech API**.
5. **APIs & Services → Credentials → Create credentials → API key**.
6. Edit the API key (important for **Render server-side** calls):
   - **Application restrictions** → **None** (do **not** use HTTP referrers — the backend has no browser referrer).
   - **API restrictions** → **Restrict key** → select **Cloud Text-to-Speech API** only.
7. Render → `first-stock-api` → **Environment**:
   - `GOOGLE_TTS_API_KEY` = your API key
   - (optional) `GOOGLE_CLOUD_PROJECT` = GCP project ID
8. **Manual Deploy** again.

#### 403 "Requests to this API ... are blocked"

This almost always means API key restrictions, not bad code:

| Check | Fix |
|-------|-----|
| Text-to-Speech API disabled | Enable **Cloud Text-to-Speech API** in API Library |
| HTTP referrer restriction on key | Set **Application restrictions** to **None** for server use |
| API restriction missing TTS | Add **Cloud Text-to-Speech API** under API restrictions |
| No billing | Link billing account to the project |
| Wrong key on Render | Re-copy key to `GOOGLE_TTS_API_KEY`, redeploy |

Optional:

| Variable | Default | Purpose |
|----------|---------|---------|
| `GOOGLE_TTS_MONTHLY_LIMIT` | `1000000` | Server-side monthly cap |
| `GOOGLE_TTS_MAX_CHARS` | `4500` | Per-request cap |

Verify: `GET /api/books/speech/status` — `google.configured` should be `true`.

## Stock snapshots (GitHub Pages)

Production **Stock Picks** loads `data/stock-picks.json` and **Stock News** loads `data/stock-news.json` from GitHub Pages. GitHub Actions rebuilds both **4× daily**:

| Schedule | Time |
|----------|------|
| Korea | 08:00, 14:00 KST |
| US Eastern | 08:00, 14:00 ET (EST cron; ±1h during EDT) |

Workflow: [`.github/workflows/update-stock-picks.yml`](../.github/workflows/update-stock-picks.yml)  
Manual run: GitHub → Actions → **Update Stock Picks** → **Run workflow**

Local build:

```bash
pip install -r backend/requirements.txt
python scripts/build_stock_picks.py
python scripts/build_stock_news.py
```

## Prediction accuracy cron

Workflow: [`.github/workflows/stock-predictions.yml`](../.github/workflows/stock-predictions.yml)  
Manual run: GitHub → Actions → **Stock Pick Predictions** → **Run workflow**

| Action | Purpose |
|--------|---------|
| `backfill_all` | Fill last 30 trading days with close prices only (temporary frame) |
| `record_kr` / `record_us` | Save today's morning picks |
| `finalize_kr` / `finalize_us` | Score picks vs same-day close |

| Schedule (UTC) | Local time | Action |
|----------------|------------|--------|
| `0 23 * * *` | KR 08:00 KST | Record KR morning picks |
| `35 7 * * *` | KR ~16:35 KST (after close) | Finalize KR vs close |
| `0 13 * * *` | US 08:00 ET (EST) | Record US morning picks |
| `5 22 * * *` | US ~17:05 ET (after close) | Finalize US vs close |

Data is sourced from unofficial Yahoo Finance feeds; availability may vary.
