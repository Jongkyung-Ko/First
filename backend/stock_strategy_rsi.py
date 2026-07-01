"""RSI 과매도 + 상승 다이버전스."""

from __future__ import annotations

from typing import Any

from stock_strategy_engine import attach_follow_up
from stock_strategy_indicators import (
    candle_closes,
    candle_lows,
    pct_change,
    pivot_low_indices,
    rsi,
)
from stock_strategy_universes import GLOBAL_UPDATE_SCHEDULE, UNIVERSE_LIMIT

STRATEGY_ID = "rsi-divergence"
ACTIVE_LABEL = "지금 진입·매집 관찰 구간"
RSI_OVERSOLD = 30
PIVOT_WING = 3
DIVERGENCE_LOOKBACK = 60
ACTIVE_PIVOT_DAYS = 10

STRATEGY_META: dict[str, Any] = {
    "id": STRATEGY_ID,
    "title": "RSI+다이버전스",
    "universe": f"KOSPI·KOSDAQ·NASDAQ·NYSE 각 TOP {UNIVERSE_LIMIT}",
    "updateSchedule": GLOBAL_UPDATE_SCHEDULE,
    "summary": "RSI(14) 과매도 구간에서 가격은 신저가·RSI는 고점을 높이는 상승 다이버전스를 포착합니다.",
    "rules": [
        "한국: 매일 18:00 KST · 미국: 매일 18:00 뉴욕(ET) 스냅샷 갱신",
        f"유니버스: 시가총액 TOP {UNIVERSE_LIMIT} (시장별)",
        f"RSI(14) 과매도: 신호일 RSI < {RSI_OVERSOLD}",
        "상승 다이버전스: 최근 pivot 저점 2개 — 가격 LL, RSI HL",
        f"활성 pivot: 최근 {ACTIVE_PIVOT_DAYS}거래일 이내",
        f"최근 {14}일 신호 · 익일 수익률·방향 일치 여부 표시",
        "갱신·표시 시각: 뉴욕(ET) 기준 통일",
    ],
    "patterns": [
        {
            "id": "rsi_div",
            "label": "RSI 과매도 + 상승 다이버전스",
            "description": "반전 매수 관찰 구간",
        },
    ],
    "disclaimer": "과거 신호·참고용이며 투자 권유가 아닙니다. 일치 = 익거래일 상승.",
}


def _bullish_divergence_at(
    lows: list[float | None],
    rsi_vals: list[float | None],
    i: int,
) -> bool:
    start = max(PIVOT_WING, i - DIVERGENCE_LOOKBACK)
    pivots = [p for p in pivot_low_indices(lows, PIVOT_WING) if start <= p < i]
    if len(pivots) < 2:
        return False
    l1, l2 = pivots[-2], pivots[-1]
    if i - l2 > ACTIVE_PIVOT_DAYS:
        return False
    low1, low2 = lows[l1], lows[l2]
    r1, r2 = rsi_vals[l1], rsi_vals[l2]
    if None in (low1, low2, r1, r2):
        return False
    return float(low2) < float(low1) and float(r2) > float(r1)


def detect_signals_from_candles(
    ticker: str,
    name: str,
    candles: list[dict[str, Any]],
    market: str = "kospi",
    currency: str = "KRW",
) -> list[dict[str, Any]]:
    if len(candles) < 30:
        return []
    closes = candle_closes(candles)
    lows = candle_lows(candles)
    rsi_vals = rsi(closes, 14)
    signals: list[dict[str, Any]] = []

    for i in range(20, len(candles)):
        c = closes[i]
        r = rsi_vals[i]
        if c is None or r is None:
            continue
        if float(r) >= RSI_OVERSOLD:
            continue
        if not _bullish_divergence_at(lows, rsi_vals, i):
            continue
        close_pct = pct_change(c, closes[i - 1])
        if close_pct is None or close_pct == 0:
            continue
        sig: dict[str, Any] = {
            "market": market,
            "currency": currency,
            "pattern": "rsi_div",
            "patternLabel": "RSI 다이버전스",
            "ticker": ticker,
            "name": name,
            "signalDate": candles[i].get("time"),
            "close": c,
            "closePct": round(close_pct, 4),
            "up": close_pct > 0,
            "rsi": round(float(r), 2),
        }
        attach_follow_up(sig, candles, i)
        signals.append(sig)
    return signals
