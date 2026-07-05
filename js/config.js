window.SUPABASE_URL = "https://djxoshkygirqgunawvye.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeG9zaGt5Z2lycWd1bmF3dnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Mzg1MDMsImV4cCI6MjA5NzUxNDUwM30.Biam_Xx-At_J-a_qmXRDeD6QbxoJM5cIUeBHi7FVXPk";

// 배포 시마다 1씩 올려 주세요 (상단 ↻ 옆 vN 표시)
window.APP_VERSION = 230;

// 배포 URL — GitHub Pages 주, Cloudflare Pages 백업 (main push 시 둘 다 자동 갱신)
window.SITE_PRIMARY_URL = "https://jongkyung-ko.github.io/First/";
window.SITE_BACKUP_URL = "https://first-66f.pages.dev/";

window.STOCK_STRATEGY_GOLDEN_JSON_URL = "data/stock-strategy-golden.json";
window.STOCK_STRATEGY_BOLLINGER_JSON_URL = "data/stock-strategy-bollinger.json";
window.STOCK_STRATEGY_RSI_JSON_URL = "data/stock-strategy-rsi.json";
window.STOCK_STRATEGY_CANDLE_JSON_URL = "data/stock-strategy-candle-support.json";
window.STOCK_STRATEGY_OBV_JSON_URL = "data/stock-strategy-obv.json";
window.STOCK_STRATEGY_BOTTOM_JSON_URL = "data/stock-strategy-bottom.json";
window.STOCK_STRATEGY_VCP_JSON_URL = "data/stock-strategy-vcp.json";
window.STOCK_FUNDAMENTALS_JSON_URL = "data/stock-fundamentals.json";
window.STOCK_QUALITY_SCORE_JSON_URL = "data/stock-quality-score.json";

window.MASTER_EMAIL = "master@digitalworld.local";
window.MASTER_INITIAL_PASSWORD = "123456";
window.ADMIN_EMAILS = ["maspro79@naver.com", "master@digitalworld.local"];
window.FUNDAMENTALS_FORCE_EMAIL = "maspro79@naver.com";
window.SHORT_TERM_FORCE_EMAIL = "maspro79@naver.com";

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
// Chart snapshots — Render API only (local dev: optional data/*.json fallback)
window.CHART_KR_JSON_URL = "data/chart-kr-snapshot.json";
window.CHART_US_JSON_URL = "data/chart-us-snapshot.json";
window.STOCK_PICKS_USE_API = isLocalDev;
// 감성뉴스: 탭 진입 시 스냅샷만 표시 · live는 Re 버튼만
window.STOCK_PICKS_LIVE_REFRESH = false;

// Audio MP3 (~118MB) — main Pages 제외, jsDelivr 고정 태그에서 로드
window.AUDIO_CDN_REPO = "Jongkyung-Ko/First";
window.AUDIO_CDN_REF = "audio-assets";
window.AUDIO_ASSET_BASE_URL =
  isLocalDev || window.IS_LOCAL_FILE_PREVIEW
    ? ""
    : `https://cdn.jsdelivr.net/gh/${window.AUDIO_CDN_REPO}@${window.AUDIO_CDN_REF}/`;

window.resolveAudioAssetUrl = function (relativePath) {
  const path = String(relativePath || "").replace(/^\.\//, "");
  if (window.AUDIO_ASSET_BASE_URL) {
    return window.AUDIO_ASSET_BASE_URL + path;
  }
  if (location.protocol === "file:") return "./" + path;
  const siteBase = location.pathname.indexOf("/First") !== -1 ? "/First/" : "/";
  return siteBase + path;
};

// 로컬에서 API 없이 테스트할 때 Render URL 강제 사용:
// window.STOCK_API_URL = "https://first-stock-api.onrender.com";
