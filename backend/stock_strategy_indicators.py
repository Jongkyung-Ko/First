"""Stock strategy — technical indicators (aligned with js/chart.js)."""

from __future__ import annotations

from typing import Any


def pct_change(curr: float | None, prev: float | None) -> float | None:
    if curr is None or prev is None or prev == 0:
        return None
    return ((curr / prev) - 1.0) * 100.0


def sma(values: list[float | None], period: int) -> list[float | None]:
    out: list[float | None] = [None] * len(values)
    for i in range(period - 1, len(values)):
        window = values[i - period + 1 : i + 1]
        if any(v is None for v in window):
            continue
        out[i] = sum(window) / period  # type: ignore[arg-type]
    return out


def bollinger(
    closes: list[float | None], period: int = 20, mult: float = 2.0
) -> tuple[list[float | None], list[float | None], list[float | None]]:
    upper: list[float | None] = [None] * len(closes)
    middle: list[float | None] = [None] * len(closes)
    lower: list[float | None] = [None] * len(closes)
    for i in range(period - 1, len(closes)):
        window = closes[i - period + 1 : i + 1]
        if any(v is None for v in window):
            continue
        mean = sum(window) / period  # type: ignore[arg-type]
        variance = sum((float(v) - mean) ** 2 for v in window) / period
        std = variance**0.5
        middle[i] = mean
        upper[i] = mean + mult * std
        lower[i] = mean - mult * std
    return upper, middle, lower


def rsi(closes: list[float | None], period: int = 14) -> list[float | None]:
    out: list[float | None] = [None] * len(closes)
    if len(closes) <= period:
        return out

    gains = 0.0
    losses = 0.0
    for i in range(1, period + 1):
        diff = float(closes[i]) - float(closes[i - 1])  # type: ignore[arg-type]
        if diff >= 0:
            gains += diff
        else:
            losses -= diff
    avg_gain = gains / period
    avg_loss = losses / period
    rs = 100.0 if avg_loss == 0 else avg_gain / avg_loss
    out[period] = 100.0 - 100.0 / (1.0 + rs)

    for i in range(period + 1, len(closes)):
        if closes[i] is None or closes[i - 1] is None:
            continue
        diff = float(closes[i]) - float(closes[i - 1])
        gain = diff if diff > 0 else 0.0
        loss = -diff if diff < 0 else 0.0
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        rs_val = 100.0 if avg_loss == 0 else avg_gain / avg_loss
        out[i] = 100.0 - 100.0 / (1.0 + rs_val)
    return out


def pivot_low_indices(values: list[float | None], wing: int = 3) -> list[int]:
    pivots: list[int] = []
    for i in range(wing, len(values) - wing):
        v = values[i]
        if v is None:
            continue
        if all(
            values[i - k] is not None and v <= float(values[i - k])  # type: ignore[arg-type]
            for k in range(1, wing + 1)
        ) and all(
            values[i + k] is not None and v <= float(values[i + k])  # type: ignore[arg-type]
            for k in range(1, wing + 1)
        ):
            pivots.append(i)
    return pivots


def candle_closes(candles: list[dict[str, Any]]) -> list[float | None]:
    return [c.get("close") for c in candles]


def candle_lows(candles: list[dict[str, Any]]) -> list[float | None]:
    return [c.get("low") for c in candles]
