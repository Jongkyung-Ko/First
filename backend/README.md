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

## Stock Picks snapshots (GitHub Pages)

Production **Stock Picks** loads `data/stock-picks.json` from GitHub Pages (fast). GitHub Actions rebuilds it **4× daily**:

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
```

## Endpoints

- `GET /api/headlines?market=all|kr|us&lang=ko|original&limit=40` — headline feed (`lang=ko` translates titles to Korean)
- `GET /api/recommendations?market=kr_kospi|kr_kosdaq|us&lang=ko&limit=10` — live picks (local dev / fallback)
- `GET /health` — health check

Data is sourced from unofficial Yahoo Finance feeds; availability may vary.
