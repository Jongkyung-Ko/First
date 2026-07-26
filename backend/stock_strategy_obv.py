"""OBV 상승 다이버전스 — 가격 LL · OBV HL."""

from __future__ import annotations

from typing import Any

from stock_strategy_engine import attach_follow_up
from stock_strategy_indicators import (
    candle_closes,
    candle_lows,
    candle_volumes,
    obv,
    pct_change,
    pivot_low_indices,
)
from stock_strategy_universes import GLOBAL_UPDATE_SCHEDULE, UNIVERSE_LIMIT

STRATEGY_ID = "obv-divergence"
ACTIVE_LABEL = "지금 진입·매집 관찰 구간"
PIVOT_WING = 3
DIVERGENCE_LOOKBACK = 60
ACTIVE_PIVOT_DAYS = 10

STRATEGY_META: dict[str, Any] = {
    "id": STRATEGY_ID,
    "title": "OBV+다이버전스",
    "universe": f"KOSPI·KOSDAQ·NASDAQ·NYSE 각 TOP {UNIVERSE_LIMIT}",
    "updateSchedule": GLOBAL_UPDATE_SCHEDULE,
    "summary": "가격은 신저가를 갱신하는데 OBV는 고점을 높이는 상승 다이버전스(매집) 구간을 포착합니다.",
    "rules": [
        "한국: 매일 18:00 KST · 미국: 매일 18:00 뉴욕(ET) 스냅샷 갱신",
        f"유니버스: 시가총액 TOP {UNIVERSE_LIMIT} (시장별)",
        "OBV: 종가 상승일 +거래량 · 하락일 -거래량 누적",
        "상승 다이버전스: 최근 pivot 저점 2개 — 가격 LL, OBV HL",
        f"활성 pivot: 최근 {ACTIVE_PIVOT_DAYS}거래일 이내",
        f"최근 {14}일 신호 · 익일 수익률·방향 일치 여부 표시",
        "갱신·표시 시각: 뉴욕(ET) 기준 통일",
    ],
    "patterns": [
        {
            "id": "obv_div",
            "label": "OBV 다이버전스",
            "description": "거래량 누적 기준 매집 다이버전스 관찰",
        },
    ],
    "disclaimer": "과거 신호·참고용이며 투자 권유가 아닙니다. 일치 = 익거래일 상승.",
}


def _bullish_obv_divergence_at(
    lows: list[float | None],
    obv_vals: list[float | None],
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
    o1, o2 = obv_vals[l1], obv_vals[l2]
    if None in (low1, low2, o1, o2):
        return False
    return float(low2) < float(low1) and float(o2) > float(o1)


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
    volumes = candle_volumes(candles)
    obv_vals = obv(closes, volumes)
    signals: list[dict[str, Any]] = []

    for i in range(20, len(candles)):
        c = closes[i]
        o = obv_vals[i]
        if c is None or o is None:
            continue
        if not _bullish_obv_divergence_at(lows, obv_vals, i):
            continue
        close_pct = pct_change(c, closes[i - 1])
        if close_pct is None or close_pct == 0:
            continue
        sig: dict[str, Any] = {
            "market": market,
            "currency": currency,
            "pattern": "obv_div",
            "patternLabel": "OBV 다이버전스",
            "ticker": ticker,
            "name": name,
            "signalDate": candles[i].get("time"),
            "close": c,
            "closePct": round(close_pct, 4),
            "up": close_pct > 0,
            "obv": round(float(o), 2),
        }
        attach_follow_up(sig, candles, i)
        signals.append(sig)
    return signals
