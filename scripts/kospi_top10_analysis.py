#!/usr/bin/env python3
"""KOSPI TOP 10 — 일봉 지표 전일 대비 등락비율(A안) CSV 생성."""

from __future__ import annotations

import csv
import os
import sys
from datetime import date, datetime, timedelta, timezone
from typing import Any

import yfinance as yf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

KOSPI_TOP_10: list[tuple[str, str]] = [
    ("005930.KS", "삼성전자"),
    ("000660.KS", "SK하이닉스"),
    ("373220.KS", "LG에너지솔루션"),
    ("207940.KS", "삼성바이오로직스"),
    ("005380.KS", "현대차"),
    ("329180.KS", "HD현대중공업"),
    ("000270.KS", "기아"),
    ("105560.KS", "KB금융"),
    ("035420.KS", "NAVER"),
    ("055550.KS", "신한지주"),
]

OUTPUT_MONTHS = 2
FETCH_PERIOD = "5mo"
CSV_HEADERS = [
    "종목코드",
    "종목명",
    "일자",
    "종가",
    "SMA5_등락비율",
    "SMA20_등락비율",
    "SMA60_등락비율",
    "BB상_등락비율",
    "BB중_등락비율",
    "BB하_등락비율",
    "RSI_등락비율",
    "MACD_등락비율",
]


def pct_change(curr: float | None, prev: float | None) -> str:
    if curr is None or prev is None or prev == 0:
        return ""
    return f"{((curr / prev) - 1) * 100:.4f}"


def sma_series(closes: list[float], period: int) -> list[float | None]:
    out: list[float | None] = [None] * len(closes)
    for i in range(period - 1, len(closes)):
        window = closes[i - period + 1 : i + 1]
        out[i] = sum(window) / period
    return out


def bollinger_series(closes: list[float], period: int = 20, mult: float = 2.0) -> tuple[list[float | None], list[float | None], list[float | None]]:
    upper: list[float | None] = [None] * len(closes)
    middle: list[float | None] = [None] * len(closes)
    lower: list[float | None] = [None] * len(closes)
    for i in range(period - 1, len(closes)):
        window = closes[i - period + 1 : i + 1]
        mean = sum(window) / period
        variance = sum((x - mean) ** 2 for x in window) / period
        std = variance**0.5
        middle[i] = mean
        upper[i] = mean + mult * std
        lower[i] = mean - mult * std
    return upper, middle, lower


def rsi_series(closes: list[float], period: int = 14) -> list[float | None]:
    out: list[float | None] = [None] * len(closes)
    if len(closes) <= period:
        return out

    gains = 0.0
    losses = 0.0
    for i in range(1, period + 1):
        diff = closes[i] - closes[i - 1]
        if diff >= 0:
            gains += diff
        else:
            losses -= diff
    avg_gain = gains / period
    avg_loss = losses / period
    rs = 100.0 if avg_loss == 0 else avg_gain / avg_loss
    out[period] = 100 - 100 / (1 + rs)

    for i in range(period + 1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gain = diff if diff > 0 else 0.0
        loss = -diff if diff < 0 else 0.0
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        rs_val = 100.0 if avg_loss == 0 else avg_gain / avg_loss
        out[i] = 100 - 100 / (1 + rs_val)
    return out


def ema_array(data: list[float], period: int) -> list[float | None]:
    arr: list[float | None] = [None] * len(data)
    k = 2 / (period + 1)
    prev: float | None = None
    for i in range(len(data)):
        if i < period - 1:
            continue
        if prev is None:
            prev = sum(data[i - period + 1 : i + 1]) / period
        else:
            prev = data[i] * k + prev * (1 - k)
        arr[i] = prev
    return arr


def macd_series(closes: list[float], fast: int = 12, slow: int = 26, signal_period: int = 9) -> list[float | None]:
    out: list[float | None] = [None] * len(closes)
    fast_arr = ema_array(closes, fast)
    slow_arr = ema_array(closes, slow)
    macd_line: list[float] = []
    macd_idx: list[int] = []
    for i in range(len(closes)):
        if fast_arr[i] is not None and slow_arr[i] is not None:
            macd_line.append(fast_arr[i] - slow_arr[i])  # type: ignore[operator]
            macd_idx.append(i)
    if not macd_line:
        return out

    k = 2 / (signal_period + 1)
    sig_prev: float | None = None
    signal_values: list[tuple[int, float]] = []
    for j, val in enumerate(macd_line):
        if j < signal_period - 1:
            continue
        if sig_prev is None:
            sig_prev = sum(macd_line[j - signal_period + 1 : j + 1]) / signal_period
        else:
            sig_prev = val * k + sig_prev * (1 - k)
        signal_values.append((macd_idx[j], val))

    for idx, val in signal_values:
        out[idx] = val
    return out


def fetch_candles(ticker: str) -> list[dict[str, Any]]:
    hist = yf.Ticker(ticker).history(period=FETCH_PERIOD, interval="1d", auto_adjust=False)
    if hist is None or hist.empty:
        return []

    candles: list[dict[str, Any]] = []
    for idx, row in hist.iterrows():
        close = row.get("Close")
        if close is None or (hasattr(close, "__float__") and float(close) != float(close)):
            continue
        close_f = float(close)
        if hasattr(idx, "date"):
            day = idx.date()
        elif hasattr(idx, "to_pydatetime"):
            day = idx.to_pydatetime().date()
        else:
            day = datetime.fromisoformat(str(idx)[:10]).date()
        candles.append({"date": day, "close": round(close_f, 4)})
    return candles


def build_rows(ticker: str, name: str, cutoff: date) -> list[dict[str, str]]:
    candles = fetch_candles(ticker)
    if not candles:
        return []

    dates = [c["date"] for c in candles]
    closes = [c["close"] for c in candles]

    sma5 = sma_series(closes, 5)
    sma20 = sma_series(closes, 20)
    sma60 = sma_series(closes, 60)
    bb_u, bb_m, bb_l = bollinger_series(closes, 20, 2.0)
    rsi = rsi_series(closes, 14)
    macd = macd_series(closes, 12, 26, 9)

    rows: list[dict[str, str]] = []
    for i in range(len(candles)):
        if dates[i] < cutoff:
            continue
        prev = i - 1
        row = {
            "종목코드": ticker,
            "종목명": name,
            "일자": dates[i].isoformat(),
            "종가": f"{closes[i]:.4f}",
            "SMA5_등락비율": pct_change(sma5[i], sma5[prev] if prev >= 0 else None),
            "SMA20_등락비율": pct_change(sma20[i], sma20[prev] if prev >= 0 else None),
            "SMA60_등락비율": pct_change(sma60[i], sma60[prev] if prev >= 0 else None),
            "BB상_등락비율": pct_change(bb_u[i], bb_u[prev] if prev >= 0 else None),
            "BB중_등락비율": pct_change(bb_m[i], bb_m[prev] if prev >= 0 else None),
            "BB하_등락비율": pct_change(bb_l[i], bb_l[prev] if prev >= 0 else None),
            "RSI_등락비율": pct_change(rsi[i], rsi[prev] if prev >= 0 else None),
            "MACD_등락비율": pct_change(macd[i], macd[prev] if prev >= 0 else None),
        }
        rows.append(row)
    return rows


def main() -> None:
    today = datetime.now(timezone.utc).date()
    cutoff = today - timedelta(days=OUTPUT_MONTHS * 31)

    out_dir = os.path.join(ROOT, "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "kospi-top10-analysis.csv")

    all_rows: list[dict[str, str]] = []
    for ticker, name in KOSPI_TOP_10:
        print(f"Analyzing {ticker} {name}...")
        rows = build_rows(ticker, name, cutoff)
        print(f"  -> {len(rows)} rows")
        all_rows.extend(rows)

    all_rows.sort(key=lambda r: (r["종목코드"], r["일자"]))

    with open(out_path, "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_HEADERS)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"Wrote {out_path} ({len(all_rows)} rows, since {cutoff.isoformat()})")


if __name__ == "__main__":
    main()
