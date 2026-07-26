"""볼린저 밴드 — 하단 반등 · 상단 돌파."""

from __future__ import annotations

from typing import Any

from stock_strategy_engine import attach_follow_up
from stock_strategy_indicators import bollinger, candle_closes, pct_change
from stock_strategy_universes import GLOBAL_UPDATE_SCHEDULE, UNIVERSE_LIMIT

STRATEGY_ID = "bollinger"
ACTIVE_LABEL = "지금 진입·매집 관찰 구간"

STRATEGY_META: dict[str, Any] = {
    "id": STRATEGY_ID,
    "title": "볼린저밴드",
    "universe": f"KOSPI·KOSDAQ·NASDAQ·NYSE 각 TOP {UNIVERSE_LIMIT}",
    "updateSchedule": GLOBAL_UPDATE_SCHEDULE,
    "summary": "BB(20, 2σ) 하단 반등과 상단 돌파 신호를 스캔합니다.",
    "rules": [
        "한국: 매일 18:00 KST · 미국: 매일 18:00 뉴욕(ET) 스냅샷 갱신",
        f"유니버스: 시가총액 TOP {UNIVERSE_LIMIT} (시장별)",
        "하단 반등: 전일 저가 ≤ 하단밴드, 당일 종가 > 하단밴드·전일 종가",
        "상단 돌파: 당일 종가 > 상단밴드",
        f"최근 {14}일 신호 · 익일 수익률·방향 일치 여부 표시",
        "갱신·표시 시각: 뉴욕(ET) 기준 통일",
    ],
    "patterns": [
        {
            "id": "lower_bounce",
            "label": "하단 반등",
            "description": "하단 밴드 터치 후 반등 — 역추세 매수 관찰",
        },
        {
            "id": "upper_break",
            "label": "상단 돌파",
            "description": "상단 밴드 돌파 — 추세·모멘텀 관찰",
        },
    ],
    "disclaimer": "과거 신호·참고용이며 투자 권유가 아닙니다. 일치 = 익거래일 상승.",
}


def detect_signals_from_candles(
    ticker: str,
    name: str,
    candles: list[dict[str, Any]],
    market: str = "kospi",
    currency: str = "KRW",
) -> list[dict[str, Any]]:
    if len(candles) < 22:
        return []
    closes = candle_closes(candles)
    upper, middle, lower = bollinger(closes, 20, 2.0)
    signals: list[dict[str, Any]] = []

    for i in range(21, len(candles)):
        c = closes[i]
        u, m, lo = upper[i], middle[i], lower[i]
        prev_c = closes[i - 1]
        prev_lo = lower[i - 1]
        low_i = candles[i].get("low")
        prev_low = candles[i - 1].get("low")
        if None in (c, u, m, lo, prev_c):
            continue
        close_pct = pct_change(c, prev_c)
        if close_pct is None or close_pct == 0:
            continue

        patterns: list[str] = []
        if (
            prev_lo is not None
            and prev_low is not None
            and float(prev_low) <= float(prev_lo)
            and float(c) > float(lo)
            and float(c) > float(prev_c)
        ):
            patterns.append("lower_bounce")
        if float(c) > float(u):
            patterns.append("upper_break")

        for pattern in patterns:
            sig: dict[str, Any] = {
                "market": market,
                "currency": currency,
                "pattern": pattern,
                "patternLabel": "하단 반등" if pattern == "lower_bounce" else "상단 돌파",
                "ticker": ticker,
                "name": name,
                "signalDate": candles[i].get("time"),
                "close": c,
                "closePct": round(close_pct, 4),
                "up": close_pct > 0,
                "bbUpper": round(float(u), 4),
                "bbMiddle": round(float(m), 4),
                "bbLower": round(float(lo), 4),
            }
            attach_follow_up(sig, candles, i)
            signals.append(sig)
    return signals
