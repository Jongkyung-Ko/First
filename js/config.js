window.SUPABASE_URL = "https://djxoshkygirqgunawvye.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeG9zaGt5Z2lycWd1bmF3dnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Mzg1MDMsImV4cCI6MjA5NzUxNDUwM30.Biam_Xx-At_J-a_qmXRDeD6QbxoJM5cIUeBHi7FVXPk";

// 배포 시마다 1씩 올려 주세요 (상단 ↻ 옆 vN 표시)
window.APP_VERSION = 36;

window.STOCK_STRATEGY_GOLDEN_JSON_URL = "data/stock-strategy-golden.json";
window.STOCK_STRATEGY_BOLLINGER_JSON_URL = "data/stock-strategy-bollinger.json";
window.STOCK_STRATEGY_RSI_JSON_URL = "data/stock-strategy-rsi.json";

window.MASTER_EMAIL = "master@digitalworld.local";
window.MASTER_INITIAL_PASSWORD = "123456";

// Stock headlines API (FastAPI + yfinance on Render)
// Use Render for GitHub Pages, file:// previews, and any non-localhost host.
const isLocalDev =
  location.hostname === "localhost" || location.hostname === "127.0.0.1";

window.STOCK_API_URL = isLocalDev
  ? "http://localhost:8000"
  : "https://first-stock-api.onrender.com";

window.IS_LOCAL_FILE_PREVIEW = location.protocol === "file:";

// Stock Picks snapshot (GitHub Pages static JSON, updated by GitHub Actions)
window.STOCK_PICKS_JSON_URL = "data/stock-picks.json";
window.STOCK_NEWS_JSON_URL = "data/stock-news.json";
window.CHART_KR_JSON_URL = "data/chart-kr-snapshot.json";
window.CHART_US_JSON_URL = "data/chart-us-snapshot.json";
window.STOCK_PICKS_USE_API = isLocalDev;
window.STOCK_PICKS_LIVE_REFRESH = true;

// 로컬에서 API 없이 테스트할 때 Render URL 강제 사용:
// window.STOCK_API_URL = "https://first-stock-api.onrender.com";
