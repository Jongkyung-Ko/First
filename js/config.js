window.SUPABASE_URL = "https://djxoshkygirqgunawvye.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeG9zaGt5Z2lycWd1bmF3dnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Mzg1MDMsImV4cCI6MjA5NzUxNDUwM30.Biam_Xx-At_J-a_qmXRDeD6QbxoJM5cIUeBHi7FVXPk";

window.MASTER_EMAIL = "master@digitalworld.local";
window.MASTER_INITIAL_PASSWORD = "123456";

// Stock headlines API (FastAPI + yfinance on Render)
// Local dev uses localhost; GitHub Pages uses Render.
window.STOCK_API_URL =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:8000"
    : "https://first-stock-api.onrender.com";
