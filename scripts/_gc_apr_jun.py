import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from collections import Counter, defaultdict
import yfinance as yf
from stock_strategy_golden import detect_signals_from_candles
from stock_strategy_engine import make_yfinance_fetcher
from stock_strategy_universes import market_configs

fetch = make_yfinance_fetcher()
cfg = market_configs()["kospi"]
tz = cfg["timezone"]
universe = cfg["universe"]

hist = yf.Ticker("^KS11").history(start="2026-04-01", end="2026-07-05", auto_adjust=True)
print("=== KOSPI (^KS11) monthly ===")
for month in ["2026-04", "2026-05", "2026-06"]:
    rows = [(d.date(), float(r["Close"])) for d, r in hist.iterrows() if str(d.date())[:7] == month]
    if not rows:
        continue
    rows.sort()
    start, end = rows[0][1], rows[-1][1]
    chg = (end / start - 1) * 100
    peak = rows[0][1]
    maxdd = 0.0
    for _, p in rows:
        peak = max(peak, p)
        maxdd = min(maxdd, (p / peak - 1) * 100)
    print(f"{month}: {start:.0f} -> {end:.0f}  month_chg={chg:+.1f}%  max_intra_month_dd={maxdd:.1f}%")

print()
print("=== Golden Cross KOSPI by month (immediate 1d) ===")

def idx_by_date(candles, sd):
    t = str(sd)[:10]
    for j, c in enumerate(candles):
        if str(c.get("time", ""))[:10] == t:
            return j
    return None

by_month = defaultdict(list)
patterns = defaultdict(Counter)
for ticker, name in universe:
    payload = fetch(ticker, "6mo", tz=tz, after_scheduled_update=True)
    candles = payload.get("candles") or []
    for sig in detect_signals_from_candles(ticker, name, candles, market="kospi"):
        sd = str(sig.get("signalDate") or "")[:10]
        if not sd.startswith("2026-0"):
            continue
        j = idx_by_date(candles, sd)
        if j is None or j + 1 >= len(candles):
            continue
        entry = float(candles[j]["close"])
        d1 = (float(candles[j + 1]["close"]) / entry - 1) * 100
        mk = sd[:7]
        by_month[mk].append({"d1": d1, "pattern": sig.get("pattern"), "up": sig.get("up")})
        patterns[mk][sig.get("pattern", "?")] += 1

for mk in sorted(by_month):
    rows = by_month[mk]
    d1s = [r["d1"] for r in rows]
    wins = sum(1 for x in d1s if x > 0)
    up_sig = sum(1 for r in rows if r["up"])
    print(f"{mk}: n={len(rows)} 1d_sum={sum(d1s):+.1f}% avg={sum(d1s)/len(d1s):+.2f}% win={wins/len(d1s)*100:.0f}% signal_day_up={up_sig/len(rows)*100:.0f}% patterns={dict(patterns[mk])}")
