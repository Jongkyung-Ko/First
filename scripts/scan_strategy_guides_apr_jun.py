#!/usr/bin/env python3
"""KOSPI TOP100 · Apr-May-Jun 2026 · strategy guide stats."""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from kr_market_universes import KOSPI_TOP_100
from stock_strategy_candle_support import detect_signals_from_candles as candle_detect
from stock_strategy_bottom import detect_signals_from_candles as bottom_detect
from stock_strategy_engine import make_yfinance_fetcher
from stock_strategy_obv import detect_signals_from_candles as obv_detect
from stock_strategy_rsi import detect_signals_from_candles as rsi_detect
from stock_strategy_vcp import detect_signals_from_candles as vcp_detect

STRATEGIES = {
    "rsi": ("RSI+다이버전스", rsi_detect),
    "candle": ("지지+반전캔들", candle_detect),
    "obv": ("OBV+다이버전스", obv_detect),
    "bottom": ("쌍·삼중바닥", bottom_detect),
    "vcp": ("VCP", vcp_detect),
}

MONTHS = ("2026-04", "2026-05", "2026-06")
cutoff = (datetime.now().date() - timedelta(days=183)).isoformat()
fetch = make_yfinance_fetcher()
tz = ZoneInfo("Asia/Seoul")


def scan(detect_fn):
    by_month: dict[str, list[float]] = defaultdict(list)
    for ticker, name in KOSPI_TOP_100:
        payload = fetch(ticker, "6mo", tz=tz, after_scheduled_update=True)
        candles = payload.get("candles") or []
        for sig in detect_fn(ticker, name, candles, market="kospi"):
            sd = str(sig.get("signalDate") or "")[:10]
            if sd < cutoff or not sd.startswith("2026-0"):
                continue
            d1 = sig.get("holdDay1ReturnPct")
            if d1 is None:
                continue
            by_month[sd[:7]].append(float(d1))
    out = {}
    for mk in MONTHS:
        d1s = by_month.get(mk, [])
        wins = sum(1 for x in d1s if x > 0)
        out[mk] = {
            "n": len(d1s),
            "sum1d": round(sum(d1s), 1) if d1s else 0,
            "avg1d": round(sum(d1s) / len(d1s), 2) if d1s else 0,
            "winPct": round(wins / len(d1s) * 100) if d1s else 0,
        }
    total = [x for mk in MONTHS for x in by_month.get(mk, [])]
    out["total"] = {
        "n": len(total),
        "sum1d": round(sum(total), 1) if total else 0,
    }
    return out


def main() -> None:
    result = {}
    for key, (_, fn) in STRATEGIES.items():
        print(f"Scanning {key}...", flush=True)
        result[key] = scan(fn)
        for mk in MONTHS:
            r = result[key][mk]
            print(
                f"  {mk}: n={r['n']} sum={r['sum1d']:+.1f}% avg={r['avg1d']:+.2f}% win={r['winPct']:.0f}%"
            )
    out_path = ROOT / "scripts" / "strategy_guides_apr_jun.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
