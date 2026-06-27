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
| `AZURE_SPEECH_KEY` | — | Azure Speech resource key (Books TTS) |
| `AZURE_SPEECH_REGION` | — | e.g. `koreacentral`, `eastus` |
| `AZURE_TTS_MONTHLY_LIMIT` | `500000` | Server-side monthly character cap (F0 free tier) |
| `GOOGLE_TTS_API_KEY` | — | Google Cloud Text-to-Speech API key (Neural2) |
| `GOOGLE_TTS_MONTHLY_LIMIT` | `1000000` | Google TTS monthly cap tracked on server |
| `FREETTS_TTS_MONTHLY_LIMIT` | `5000` | FreeTTS free-tier monthly cap (tracked on server) |

### TTS engines (Books listen)

| Engine | Env vars | Default monthly cap |
|--------|----------|---------------------|
| Azure Speech | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | 500K (F0) |
| FreeTTS | (none — proxied via API) | 5K free tier |
| Cloud TTS Neural2 | `GOOGLE_TTS_API_KEY` | 1M (adjust to your GCP quota) |

`POST /api/books/tts` accepts `{ "engine": "azure"|"freetts"|"google", "text": "...", "voice": "...", "rate": "1.0" }`.

### Azure Speech setup (Books listen)

1. [Azure Portal](https://portal.azure.com) → **Create a resource** → **Speech** (or AI Services multi-service).
2. Choose pricing tier **Free F0** for 500,000 neural TTS characters/month.
3. Copy **Key 1** and **Region** from the resource → Render service **Environment**:
   - `AZURE_SPEECH_KEY` = your key
   - `AZURE_SPEECH_REGION` = region id (e.g. `koreacentral`)
4. **Manual Deploy** on Render after saving env vars.

Commercial use: Project Gutenberg PD texts + Azure Speech under [Azure terms](https://azure.microsoft.com/support/legal/). Use **F0** tier for the free monthly quota (S0 bills per character from the first use).

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
- `GET /api/books/speech/status` — Azure TTS config + monthly usage
- `POST /api/books/translate` — translate book chunk (`{ "text": "...", "target": "ko" }`)
- `POST /api/books/tts` — Azure Neural TTS (`{ "text": "...", "voice": "en-US-JennyNeural", "rate": "1.0" }`) → `audio/mpeg`
- `GET /api/gutenberg/books` — PD book catalog (Gutendex proxy)
- `GET /api/gutenberg/text/{book_id}` — plain-text book body
- `GET /health` — health check

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
