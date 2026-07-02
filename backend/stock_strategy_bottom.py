"""쌍바닥 · 삼중바닥 — 넥라인 돌파 확정 신호."""

from __future__ import annotations

from typing import Any

from stock_strategy_engine import attach_follow_up
from stock_strategy_indicators import (
    candle_closes,
    candle_highs,
    candle_lows,
    pct_change,
    pivot_low_indices,
)
from stock_strategy_universes import GLOBAL_UPDATE_SCHEDULE, UNIVERSE_LIMIT

STRATEGY_ID = "bottom-pattern"
ACTIVE_LABEL = "지금 진입·매집 관찰 구간"
PIVOT_WING = 3
BOTTOM_TOLERANCE_PCT = 3.0
MIN_DAYS_BETWEEN = 5
MAX_DAYS_BETWEEN = 80
LOOKBACK = 120

STRATEGY_META: dict[str, Any] = {
    "id": STRATEGY_ID,
    "title": "쌍·삼중바닥",
    "universe": f"KOSPI·KOSDAQ·NASDAQ·NYSE 각 TOP {UNIVERSE_LIMIT}",
    "updateSchedule": GLOBAL_UPDATE_SCHEDULE,
    "summary": "유사 저점 2~3회 형성 후 넥라인(중간 고점) 상향 돌파 시 바닥 반등 신호를 포착합니다.",
    "rules": [
        "한국: 매일 18:00 KST · 미국: 매일 18:00 뉴욕(ET) 스냅샷 갱신",
        f"유니버스: 시가총액 TOP {UNIVERSE_LIMIT} (시장별)",
        f"pivot 저점 간격 {MIN_DAYS_BETWEEN}~{MAX_DAYS_BETWEEN}거래일",
        f"저점 유사도: ±{BOTTOM_TOLERANCE_PCT}% 이내",
        "넥라인: 저점 사이 구간 최고가",
        "신호: 종가가 넥라인 상향 돌파일",
        f"최근 {14}일 신호 · 익일 수익률·방향 일치 여부 표시",
        "갱신·표시 시각: 뉴욕(ET) 기준 통일",
    ],
    "patterns": [
        {
            "id": "double_bottom",
            "label": "쌍바닥",
            "description": "2회 저점 테스트 후 넥라인 돌파",
        },
        {
            "id": "triple_bottom",
            "label": "삼중바닥",
            "description": "3회 저점 테스트 후 넥라인 돌파",
        },
    ],
    "disclaimer": "과거 신호·참고용이며 투자 권유가 아닙니다. 일치 = 익거래일 상승.",
}

_PATTERN_LABELS = {
    "double_bottom": "쌍바닥",
    "triple_bottom": "삼중바닥",
}


def _lows_similar(a: float, b: float, tolerance_pct: float = BOTTOM_TOLERANCE_PCT) -> bool:
    if a <= 0 or b <= 0:
        return False
    mid = (a + b) / 2.0
    band = mid * (tolerance_pct / 100.0)
    return abs(a - b) <= band


def _neckline(highs: list[float | None], start: int, end: int) -> float | None:
    window = [float(h) for h in highs[start : end + 1] if h is not None]
    return max(window) if window else None


def _detect_breakout_pattern(
    lows: list[float | None],
    highs: list[float | None],
    closes: list[float | None],
    i: int,
    *,
    required_lows: int,
) -> str | None:
    start = max(PIVOT_WING, i - LOOKBACK)
    pivots = [p for p in pivot_low_indices(lows, PIVOT_WING) if start <= p < i]
    if len(pivots) < required_lows:
        return None

    c = closes[i]
    prev_c = closes[i - 1] if i > 0 else None
    if c is None or prev_c is None:
        return None

    if required_lows == 2:
        l2 = pivots[-1]
        for l1 in reversed(pivots[:-1]):
            if l2 - l1 < MIN_DAYS_BETWEEN:
                continue
            if l2 - l1 > MAX_DAYS_BETWEEN:
                break
            low1, low2 = lows[l1], lows[l2]
            if low1 is None or low2 is None:
                continue
            if not _lows_similar(float(low1), float(low2)):
                continue
            neck = _neckline(highs, l1, l2)
            if neck is None:
                continue
            if float(c) > neck and float(prev_c) <= neck:
                return "double_bottom"
        return None

    l3 = pivots[-1]
    for j in range(len(pivots) - 2, 0, -1):
        l2 = pivots[j]
        if l3 - l2 < MIN_DAYS_BETWEEN:
            continue
        for k in range(j - 1, -1, -1):
            l1 = pivots[k]
            if l3 - l1 > MAX_DAYS_BETWEEN:
                break
            if l2 - l1 < MIN_DAYS_BETWEEN:
                continue
            low1, low2, low3 = lows[l1], lows[l2], lows[l3]
            if None in (low1, low2, low3):
                continue
            if not (
                _lows_similar(float(low1), float(low2))
                and _lows_similar(float(low2), float(low3))
                and _lows_similar(float(low1), float(low3))
            ):
                continue
            neck = _neckline(highs, l1, l3)
            if neck is None:
                continue
            if float(c) > neck and float(prev_c) <= neck:
                return "triple_bottom"
    return None


def detect_signals_from_candles(
    ticker: str,
    name: str,
    candles: list[dict[str, Any]],
    market: str = "kospi",
    currency: str = "KRW",
) -> list[dict[str, Any]]:
    if len(candles) < 40:
        return []
    lows = candle_lows(candles)
    highs = candle_highs(candles)
    closes = candle_closes(candles)
    signals: list[dict[str, Any]] = []

    for i in range(25, len(candles)):
        c = closes[i]
        if c is None:
            continue
        patterns: list[str] = []
        triple = _detect_breakout_pattern(lows, highs, closes, i, required_lows=3)
        if triple:
            patterns.append(triple)
        double = _detect_breakout_pattern(lows, highs, closes, i, required_lows=2)
        if double and double not in patterns:
            patterns.append(double)

        for pattern in patterns:
            close_pct = pct_change(c, closes[i - 1])
            if close_pct is None or close_pct == 0:
                continue
            pivots = pivot_low_indices(lows, PIVOT_WING)
            neck = None
            if pattern == "double_bottom" and len(pivots) >= 2:
                l1, l2 = pivots[-2], pivots[-1]
                neck = _neckline(highs, l1, l2)
            elif pattern == "triple_bottom" and len(pivots) >= 3:
                l1, l3 = pivots[-3], pivots[-1]
                neck = _neckline(highs, l1, l3)

            sig: dict[str, Any] = {
                "market": market,
                "currency": currency,
                "pattern": pattern,
                "patternLabel": _PATTERN_LABELS.get(pattern, pattern),
                "ticker": ticker,
                "name": name,
                "signalDate": candles[i].get("time"),
                "close": c,
                "closePct": round(close_pct, 4),
                "up": close_pct > 0,
            }
            if neck is not None:
                sig["neckline"] = round(float(neck), 4)
            attach_follow_up(sig, candles, i)
            signals.append(sig)

    return signals
