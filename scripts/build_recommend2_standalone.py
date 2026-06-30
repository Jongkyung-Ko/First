#!/usr/bin/env python3
"""Build recommend2 JSON without importing full main.py (fewer deps)."""

from __future__ import annotations

import json
import os
import sys
from typing import Any

import yfinance as yf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
sys.path.insert(0, BACKEND)

from recommend2_bottom_accumulation import (  # noqa: E402
    ET,
    KST,
    collect_bottom_accumulation,
    yfinance_history_end_str,
    yfinance_history_start_str,
)


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        f = float(value)
        if f != f:
            return None
        return f
    except (TypeError, ValueError):
        return None


def fetch_chart(ticker: str, period: str = "3mo", tz=None) -> dict[str, Any]:
    zone = tz or (KST if ticker.endswith((".KS", ".KQ")) else ET)
    hist = yf.Ticker(ticker).history(
        start=yfinance_history_start_str(period, zone),
        end=yfinance_history_end_str(zone),
        interval="1d",
        auto_adjust=False,
    )
    candles: list[dict[str, Any]] = []
    if hist is not None and not hist.empty:
        for idx, row in hist.iterrows():
            close = _safe_float(row.get("Close"))
            if close is None:
                continue
            open_px = _safe_float(row.get("Open")) or close
            high_px = _safe_float(row.get("High")) or close
            low_px = _safe_float(row.get("Low")) or close
            vol = _safe_float(row.get("Volume")) or 0.0
            ts = idx.to_pydatetime()
            candles.append(
                {
                    "time": ts.strftime("%Y-%m-%d"),
                    "open": open_px,
                    "high": high_px,
                    "low": low_px,
                    "close": close,
                    "volume": vol,
                }
            )
    return {"candles": candles}


def main() -> None:
    print("Scanning KOSPI TOP50 + NASDAQ-100 + NYSE TOP100 (yfinance)...")
    payload = collect_bottom_accumulation(fetch_chart, period="3mo")
    out_path = os.path.join(ROOT, "data", "recommend2-bottom-accumulation.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    nasdaq = (payload.get("markets") or {}).get("nasdaq", {})
    nyse = (payload.get("markets") or {}).get("nyse", {})
    print(
        f"Wrote {out_path} — KOSPI T-1={payload.get('analysisDate')} · "
        f"active {payload['activeCount']} · recent {payload['recentCount']} · "
        f"NASDAQ {nasdaq.get('recentCount', 0)} · NYSE {nyse.get('recentCount', 0)}"
    )


if __name__ == "__main__":
    main()
