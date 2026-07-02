"""지지선 + 반전 캔들 — 망치형 · 샛별형 · 상승 장악형."""

from __future__ import annotations

from typing import Any

from stock_strategy_engine import attach_follow_up
from stock_strategy_indicators import candle_closes, pct_change, sma
from stock_strategy_universes import GLOBAL_UPDATE_SCHEDULE, UNIVERSE_LIMIT

STRATEGY_ID = "candle-support"
ACTIVE_LABEL = "지금 진입·매집 관찰 구간"
SUPPORT_TOLERANCE_PCT = 2.0
ROLLING_LOW_DAYS = 20

STRATEGY_META: dict[str, Any] = {
    "id": STRATEGY_ID,
    "title": "지지+반전캔들",
    "universe": f"KOSPI·KOSDAQ·NASDAQ·NYSE 각 TOP {UNIVERSE_LIMIT}",
    "updateSchedule": GLOBAL_UPDATE_SCHEDULE,
    "summary": "SMA20·SMA60·20일 저점 지지 구간에서 망치형·샛별형·상승 장악형 반전 캔들을 포착합니다.",
    "rules": [
        "한국: 매일 18:00 KST · 미국: 매일 18:00 뉴욕(ET) 스냅샷 갱신",
        f"유니버스: 시가총액 TOP {UNIVERSE_LIMIT} (시장별)",
        f"지지: 저가가 SMA20·SMA60·{ROLLING_LOW_DAYS}일 저점 ±{SUPPORT_TOLERANCE_PCT}% 이내",
        "망치형: 아래꼬리 ≥ 몸통 2배 · 위꼬리 ≤ 몸통 0.5배",
        "상승 장악: 전일 음봉 몸통을 당일 양봉이 완전 포섭",
        "샛별형: 음봉 → 소형봉 → 양봉(첫날 몸통 중간 이상 회복)",
        f"최근 {14}일 신호 · 익일 수익률·방향 일치 여부 표시",
        "갱신·표시 시각: 뉴욕(ET) 기준 통일",
    ],
    "patterns": [
        {
            "id": "hammer",
            "label": "망치형",
            "description": "지지선 터치 후 긴 아래꼬리 반전 — 바닥 매수 관찰",
        },
        {
            "id": "morning_star",
            "label": "샛별형",
            "description": "3일 반전 패턴 — 하락 후 상승 전환 관찰",
        },
        {
            "id": "bullish_engulfing",
            "label": "상승 장악형",
            "description": "전일 음봉을 양봉이 장악 — 단기 반등 관찰",
        },
    ],
    "disclaimer": "과거 신호·참고용이며 투자 권유가 아닙니다. 일치 = 익거래일 상승.",
}

_PATTERN_LABELS = {
    "hammer": "망치형",
    "morning_star": "샛별형",
    "bullish_engulfing": "상승 장악형",
}


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


def _candle_body_parts(candle: dict[str, Any]) -> dict[str, float] | None:
    o = _safe_float(candle.get("open"))
    h = _safe_float(candle.get("high"))
    l = _safe_float(candle.get("low"))
    c = _safe_float(candle.get("close"))
    if None in (o, h, l, c):
        return None
    full_range = h - l
    if full_range <= 0:
        return None
    body = abs(c - o)
    if body <= 0:
        return None
    lower_shadow = min(o, c) - l
    upper_shadow = h - max(o, c)
    return {
        "open": o,
        "high": h,
        "low": l,
        "close": c,
        "body": body,
        "full_range": full_range,
        "lower_shadow": lower_shadow,
        "upper_shadow": upper_shadow,
        "bullish": c > o,
        "bearish": c < o,
    }


def _near_support(low: float, ref: float, tolerance_pct: float = SUPPORT_TOLERANCE_PCT) -> bool:
    if ref <= 0:
        return False
    band = ref * (tolerance_pct / 100.0)
    return (ref - band) <= low <= (ref + band)


def _rolling_low(candles: list[dict[str, Any]], end_index: int, days: int) -> float | None:
    start = max(0, end_index - days + 1)
    lows: list[float] = []
    for j in range(start, end_index + 1):
        lv = _safe_float(candles[j].get("low"))
        if lv is not None:
            lows.append(lv)
    return min(lows) if lows else None


def _resolve_support(
    candles: list[dict[str, Any]],
    index: int,
    sma20: list[float | None],
    sma60: list[float | None],
) -> str | None:
    low = _safe_float(candles[index].get("low"))
    if low is None:
        return None

    roll_low = _rolling_low(candles, index, ROLLING_LOW_DAYS)
    if roll_low is not None and _near_support(low, roll_low):
        return "20일저점"

    s20 = sma20[index]
    if s20 is not None and _near_support(low, float(s20)):
        return "SMA20"

    s60 = sma60[index]
    if s60 is not None and _near_support(low, float(s60)):
        return "SMA60"

    return None


def _is_hammer(candle: dict[str, Any]) -> bool:
    parts = _candle_body_parts(candle)
    if not parts:
        return False
    body = parts["body"]
    return (
        parts["lower_shadow"] >= body * 2.0
        and parts["upper_shadow"] <= body * 0.5
        and parts["lower_shadow"] >= parts["upper_shadow"]
    )


def _is_bullish_engulfing(prev: dict[str, Any], curr: dict[str, Any]) -> bool:
    p = _candle_body_parts(prev)
    c = _candle_body_parts(curr)
    if not p or not c:
        return False
    if not p["bearish"] or not c["bullish"]:
        return False
    prev_open = p["open"]
    prev_close = p["close"]
    return c["open"] <= prev_close and c["close"] >= prev_open


def _is_morning_star(
    day0: dict[str, Any],
    day1: dict[str, Any],
    day2: dict[str, Any],
) -> bool:
    p0 = _candle_body_parts(day0)
    p1 = _candle_body_parts(day1)
    p2 = _candle_body_parts(day2)
    if not p0 or not p1 or not p2:
        return False
    if not p0["bearish"] or not p2["bullish"]:
        return False
    if p1["body"] > p0["body"] * 0.55:
        return False
    midpoint = (p0["open"] + p0["close"]) / 2.0
    return p2["close"] > midpoint


def _append_signal(
    signals: list[dict[str, Any]],
    *,
    ticker: str,
    name: str,
    candles: list[dict[str, Any]],
    index: int,
    pattern: str,
    support_type: str,
    market: str,
    currency: str,
    sma20: list[float | None],
    sma60: list[float | None],
) -> None:
    c = candles[index]
    close = _safe_float(c.get("close"))
    prev_close = _safe_float(candles[index - 1].get("close")) if index > 0 else None
    close_pct = pct_change(close, prev_close)
    if close_pct is None or close_pct == 0:
        return

    s20 = sma20[index]
    s60 = sma60[index]
    sig: dict[str, Any] = {
        "market": market,
        "currency": currency,
        "pattern": pattern,
        "patternLabel": _PATTERN_LABELS.get(pattern, pattern),
        "supportType": support_type,
        "ticker": ticker,
        "name": name,
        "signalDate": c.get("time"),
        "close": close,
        "closePct": round(close_pct, 4),
        "up": close_pct > 0,
    }
    if s20 is not None:
        sig["sma20"] = round(float(s20), 4)
    if s60 is not None:
        sig["sma60"] = round(float(s60), 4)
    attach_follow_up(sig, candles, index)
    signals.append(sig)


def detect_signals_from_candles(
    ticker: str,
    name: str,
    candles: list[dict[str, Any]],
    market: str = "kospi",
    currency: str = "KRW",
) -> list[dict[str, Any]]:
    if len(candles) < 62:
        return []

    closes = candle_closes(candles)
    sma20 = sma(closes, 20)
    sma60 = sma(closes, 60)
    signals: list[dict[str, Any]] = []

    for i in range(60, len(candles)):
        support = _resolve_support(candles, i, sma20, sma60)
        if not support:
            continue

        patterns: list[str] = []
        if _is_hammer(candles[i]):
            patterns.append("hammer")
        if i >= 1 and _is_bullish_engulfing(candles[i - 1], candles[i]):
            patterns.append("bullish_engulfing")
        if i >= 2 and _is_morning_star(candles[i - 2], candles[i - 1], candles[i]):
            patterns.append("morning_star")

        for pattern in patterns:
            _append_signal(
                signals,
                ticker=ticker,
                name=name,
                candles=candles,
                index=i,
                pattern=pattern,
                support_type=support,
                market=market,
                currency=currency,
                sma20=sma20,
                sma60=sma60,
            )

    return signals
