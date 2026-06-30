#!/usr/bin/env python3
"""KOSPI TOP 30 — 일봉 지표 등락비율(A안) + 전일 지표 vs 당일 종가 일치율 CSV."""

from __future__ import annotations

import csv
import os
from datetime import date, datetime, timedelta, timezone
from typing import Any

import yfinance as yf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

KOSPI_TOP_30: list[tuple[str, str]] = [
    ("005930.KS", "삼성전자"),
    ("000660.KS", "SK하이닉스"),
    ("402340.KS", "SK스퀘어"),
    ("009150.KS", "삼성전기"),
    ("005380.KS", "현대차"),
    ("373220.KS", "LG에너지솔루션"),
    ("032830.KS", "삼성생명"),
    ("028260.KS", "삼성물산"),
    ("329180.KS", "HD현대중공업"),
    ("034020.KS", "두산에너빌리티"),
    ("000270.KS", "기아"),
    ("207940.KS", "삼성바이오로직스"),
    ("012450.KS", "한화에어로스페이스"),
    ("105560.KS", "KB금융"),
    ("012330.KS", "현대모비스"),
    ("034730.KS", "SK"),
    ("055550.KS", "신한지주"),
    ("006400.KS", "삼성SDI"),
    ("042660.KS", "한화오션"),
    ("267260.KS", "HD현대일렉트릭"),
    ("068270.KS", "셀트리온"),
    ("010120.KS", "LS ELECTRIC"),
    ("035420.KS", "NAVER"),
    ("066570.KS", "LG전자"),
    ("298040.KS", "효성중공업"),
    ("086790.KS", "하나금융지주"),
    ("009540.KS", "HD한국조선해양"),
    ("005490.KS", "POSCO홀딩스"),
    ("042700.KS", "한미반도체"),
    ("000810.KS", "삼성화재"),
]

OUTPUT_MONTHS = 6
FETCH_PERIOD = "1y"

INDICATOR_COLS = [
    "SMA5_등락비율",
    "SMA20_등락비율",
    "SMA60_등락비율",
    "BB상_등락비율",
    "BB중_등락비율",
    "BB하_등락비율",
    "RSI_등락비율",
    "MACD_등락비율",
    "거래량_등락비율",
]

CSV_HEADERS = [
    "종목코드",
    "종목명",
    "일자",
    "종가",
    "종가_등락비율",
    "종가_방향",
    *INDICATOR_COLS,
    *[
        col
        for c in INDICATOR_COLS
        for col in (f"{c.replace('_등락비율', '')}_전일방향", f"{c.replace('_등락비율', '')}_종가일치")
    ],
]

SUMMARY_HEADERS = [
    "종목코드",
    "종목명",
    *[f"{c.replace('_등락비율', '')}_일치율" for c in INDICATOR_COLS],
    "전체지표동시일치율",
    "비교가능일수",
]


def pct_change(curr: float | None, prev: float | None) -> str:
    if curr is None or prev is None or prev == 0:
        return ""
    return f"{((curr / prev) - 1) * 100:.4f}"


def parse_pct(value: str) -> float | None:
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def direction_label(value: str) -> str:
    n = parse_pct(value)
    if n is None:
        return ""
    if n > 0:
        return "상승"
    if n < 0:
        return "하락"
    return "보합"


def direction_sign(value: str) -> int | None:
    n = parse_pct(value)
    if n is None:
        return None
    if n > 0:
        return 1
    if n < 0:
        return -1
    return 0


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
        volume = row.get("Volume")
        volume_f = float(volume) if volume is not None and float(volume) == float(volume) else None
        candles.append({"date": day, "close": round(close_f, 4), "volume": volume_f})
    return candles


def build_rows(ticker: str, name: str, cutoff: date) -> list[dict[str, str]]:
    candles = fetch_candles(ticker)
    if not candles:
        return []

    dates = [c["date"] for c in candles]
    closes = [c["close"] for c in candles]
    volumes = [c.get("volume") for c in candles]

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
            "종가_등락비율": pct_change(closes[i], closes[prev] if prev >= 0 else None),
            "종가_방향": "",
            "SMA5_등락비율": pct_change(sma5[i], sma5[prev] if prev >= 0 else None),
            "SMA20_등락비율": pct_change(sma20[i], sma20[prev] if prev >= 0 else None),
            "SMA60_등락비율": pct_change(sma60[i], sma60[prev] if prev >= 0 else None),
            "BB상_등락비율": pct_change(bb_u[i], bb_u[prev] if prev >= 0 else None),
            "BB중_등락비율": pct_change(bb_m[i], bb_m[prev] if prev >= 0 else None),
            "BB하_등락비율": pct_change(bb_l[i], bb_l[prev] if prev >= 0 else None),
            "RSI_등락비율": pct_change(rsi[i], rsi[prev] if prev >= 0 else None),
            "MACD_등락비율": pct_change(macd[i], macd[prev] if prev >= 0 else None),
            "거래량_등락비율": pct_change(volumes[i], volumes[prev] if prev >= 0 else None),
        }
        row["종가_방향"] = direction_label(row["종가_등락비율"])
        rows.append(row)
    return rows


def enrich_match_columns(rows: list[dict[str, str]]) -> None:
    for i in range(1, len(rows)):
        prev_row = rows[i - 1]
        close_dir = direction_sign(rows[i]["종가_등락비율"])
        for col in INDICATOR_COLS:
            base = col.replace("_등락비율", "")
            prev_sign = direction_sign(prev_row[col])
            rows[i][f"{base}_전일방향"] = direction_label(prev_row[col])
            if close_dir in (None, 0) or prev_sign in (None, 0):
                rows[i][f"{base}_종가일치"] = ""
            else:
                rows[i][f"{base}_종가일치"] = "1" if close_dir == prev_sign else "0"

    if rows:
        for col in INDICATOR_COLS:
            base = col.replace("_등락비율", "")
            rows[0][f"{base}_전일방향"] = ""
            rows[0][f"{base}_종가일치"] = ""


def build_summary(rows_by_code: dict[str, list[dict[str, str]]]) -> list[dict[str, str]]:
    summary: list[dict[str, str]] = []
    for code, rows in sorted(rows_by_code.items()):
        item: dict[str, str] = {"종목코드": code, "종목명": rows[0]["종목명"]}
        all_match = 0
        all_total = 0

        for col in INDICATOR_COLS:
            base = col.replace("_등락비율", "")
            match_col = f"{base}_종가일치"
            matched = sum(1 for row in rows if row.get(match_col) == "1")
            total = sum(1 for row in rows if row.get(match_col) in ("1", "0"))
            item[f"{base}_일치율"] = f"{(matched / total) * 100:.1f}%" if total else ""

        for row in rows:
            flags = [row.get(f"{c.replace('_등락비율', '')}_종가일치", "") for c in INDICATOR_COLS]
            comparable = [f for f in flags if f in ("1", "0")]
            if not comparable:
                continue
            all_total += 1
            if all(f == "1" for f in comparable):
                all_match += 1

        item["전체지표동시일치율"] = f"{(all_match / all_total) * 100:.1f}%" if all_total else ""
        item["비교가능일수"] = str(all_total)
        summary.append(item)
    return summary


def main() -> None:
    today = datetime.now(timezone.utc).date()
    cutoff = today - timedelta(days=OUTPUT_MONTHS * 31)

    out_dir = os.path.join(ROOT, "data")
    os.makedirs(out_dir, exist_ok=True)
    analysis_path = os.path.join(out_dir, "kospi-top30-analysis.csv")
    summary_path = os.path.join(out_dir, "kospi-top30-match-summary.csv")

    all_rows: list[dict[str, str]] = []
    rows_by_code: dict[str, list[dict[str, str]]] = {}
    for ticker, name in KOSPI_TOP_30:
        print(f"Analyzing {ticker} {name}...")
        rows = build_rows(ticker, name, cutoff)
        enrich_match_columns(rows)
        print(f"  -> {len(rows)} rows")
        all_rows.extend(rows)
        rows_by_code[ticker] = rows

    all_rows.sort(key=lambda r: (r["종목코드"], r["일자"]))
    summary = build_summary(rows_by_code)

    with open(analysis_path, "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_HEADERS)
        writer.writeheader()
        writer.writerows(all_rows)

    with open(summary_path, "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=SUMMARY_HEADERS)
        writer.writeheader()
        writer.writerows(summary)

    print(f"Wrote {analysis_path} ({len(all_rows)} rows, since {cutoff.isoformat()})")
    print(f"Wrote {summary_path} ({len(summary)} stocks)")


if __name__ == "__main__":
    main()
