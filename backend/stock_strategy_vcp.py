"""VCP — Volatility Contraction Pattern (변동성 수축 · 피벗 돌파)."""

from __future__ import annotations

from typing import Any

from stock_strategy_engine import attach_follow_up
from stock_strategy_indicators import (
    candle_closes,
    candle_highs,
    candle_lows,
    candle_volumes,
    pct_change,
    sma,
)
from stock_strategy_universes import GLOBAL_UPDATE_SCHEDULE, UNIVERSE_LIMIT

STRATEGY_ID = "vcp"
ACTIVE_LABEL = "지금 진입·매집 관찰 구간"
PEAK_LOOKBACK = 50
MIN_PULLBACK_PCT = 8.0
MAX_PULLBACK_PCT = 35.0
PIVOT_DAYS = 15
VOL_SURGE_RATIO = 1.25
VOL_DRY_RATIO = 0.85

STRATEGY_META: dict[str, Any] = {
    "id": STRATEGY_ID,
    "title": "VCP",
    "universe": f"KOSPI·KOSDAQ·NASDAQ·NYSE 각 TOP {UNIVERSE_LIMIT}",
    "updateSchedule": GLOBAL_UPDATE_SCHEDULE,
    "summary": "고점 대비 조정 구간에서 변동폭·거래량이 단계적으로 수축한 뒤 피벗을 돌파하는 패턴을 포착합니다.",
    "rules": [
        "한국: 매일 18:00 KST · 미국: 매일 18:00 뉴욕(ET) 스냅샷 갱신",
        f"유니버스: 시가총액 TOP {UNIVERSE_LIMIT} (시장별)",
        f"베이스: 최근 {PEAK_LOOKBACK}일 고점 대비 {MIN_PULLBACK_PCT}~{MAX_PULLBACK_PCT}% 조정",
        "수축: 30·20·10일 가격범위%가 단계적 축소",
        "거래량 수축: 최근 5일 평균 < 20일 전 평균의 85%",
        f"변동성 수축: 피벗({PIVOT_DAYS}일 고점) 미돌파 · 매집 관찰",
        f"피벗 돌파: 종가 > {PIVOT_DAYS}일 고점 · 거래량 {VOL_SURGE_RATIO}배 이상",
        f"최근 {14}일 신호 · 익일 수익률·방향 일치 여부 표시",
        "갱신·표시 시각: 뉴욕(ET) 기준 통일",
    ],
    "patterns": [
        {
            "id": "vcp_contraction",
            "label": "변동성 수축",
            "description": "범위·거래량 수축 완료 · 피벗 돌파 전 매집 관찰",
        },
        {
            "id": "vcp_breakout",
            "label": "피벗 돌파",
            "description": "수축 베이스 상단 돌파 + 거래량 증가",
        },
    ],
    "disclaimer": "과거 신호·참고용이며 투자 권유가 아닙니다. 일치 = 익거래일 상승.",
}

_PATTERN_LABELS = {
    "vcp_contraction": "변동성 수축",
    "vcp_breakout": "피벗 돌파",
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


def _window_range_pct(
    highs: list[float | None],
    lows: list[float | None],
    closes: list[float | None],
    end: int,
    days: int,
) -> float | None:
    start = max(0, end - days + 1)
    h_vals = [float(h) for h in highs[start : end + 1] if h is not None]
    l_vals = [float(l) for l in lows[start : end + 1] if l is not None]
    c = closes[end]
    if not h_vals or not l_vals or c is None or float(c) <= 0:
        return None
    return ((max(h_vals) - min(l_vals)) / float(c)) * 100.0


def _avg_volume(volumes: list[float | None], end: int, days: int) -> float | None:
    start = max(0, end - days + 1)
    vals = [float(v) for v in volumes[start : end + 1] if v is not None and float(v) > 0]
    if not vals:
        return None
    return sum(vals) / len(vals)


def _vcp_base_context(
    highs: list[float | None],
    closes: list[float | None],
    i: int,
) -> tuple[float, float, float] | None:
    start = max(0, i - PEAK_LOOKBACK + 1)
    h_vals = [float(h) for h in highs[start : i + 1] if h is not None]
    c = closes[i]
    if not h_vals or c is None:
        return None
    peak = max(h_vals)
    close_f = float(c)
    if peak <= 0:
        return None
    pullback_pct = ((peak - close_f) / peak) * 100.0
    if pullback_pct < MIN_PULLBACK_PCT or pullback_pct > MAX_PULLBACK_PCT:
        return None
    return peak, close_f, pullback_pct


def _has_contractions(
    highs: list[float | None],
    lows: list[float | None],
    closes: list[float | None],
    i: int,
) -> bool:
    r30 = _window_range_pct(highs, lows, closes, i, 30)
    r20 = _window_range_pct(highs, lows, closes, i, 20)
    r10 = _window_range_pct(highs, lows, closes, i, 10)
    if None in (r30, r20, r10):
        return False
    if not (r30 > r20 > r10):
        return False
    return r20 <= r30 * 0.9 and r10 <= r20 * 0.9


def _volume_contracting(volumes: list[float | None], i: int) -> bool:
    recent = _avg_volume(volumes, i, 5)
    prior = _avg_volume(volumes, i - 5, 20)
    if recent is None or prior is None or prior <= 0:
        return False
    return recent < prior * VOL_DRY_RATIO


def _pivot_high(highs: list[float | None], end: int, days: int) -> float | None:
    start = max(0, end - days + 1)
    h_vals = [float(h) for h in highs[start : end + 1] if h is not None]
    return max(h_vals) if h_vals else None


def _detect_patterns_at(
    highs: list[float | None],
    lows: list[float | None],
    closes: list[float | None],
    volumes: list[float | None],
    i: int,
) -> list[str]:
    base = _vcp_base_context(highs, closes, i)
    if not base:
        return []
    if not _has_contractions(highs, lows, closes, i):
        return []
    if not _volume_contracting(volumes, i):
        return []

    peak, close_f, pullback_pct = base
    pivot = _pivot_high(highs, i, PIVOT_DAYS)
    if pivot is None:
        return []

    patterns: list[str] = []
    prev_pivot = _pivot_high(highs, i - 1, PIVOT_DAYS) if i > 0 else None
    vol_today = volumes[i]
    vol_avg = _avg_volume(volumes, i - 1, 20)

    if (
        prev_pivot is not None
        and close_f > prev_pivot
        and vol_today is not None
        and vol_avg is not None
        and vol_avg > 0
        and float(vol_today) >= vol_avg * VOL_SURGE_RATIO
    ):
        patterns.append("vcp_breakout")
    elif close_f < pivot * 0.995 and close_f >= pivot * 0.88:
        patterns.append("vcp_contraction")

    return patterns


def detect_signals_from_candles(
    ticker: str,
    name: str,
    candles: list[dict[str, Any]],
    market: str = "kospi",
    currency: str = "KRW",
) -> list[dict[str, Any]]:
    if len(candles) < PEAK_LOOKBACK + 10:
        return []

    closes = candle_closes(candles)
    highs = candle_highs(candles)
    lows = candle_lows(candles)
    volumes = candle_volumes(candles)
    sma50 = sma(closes, 50)
    signals: list[dict[str, Any]] = []

    for i in range(PEAK_LOOKBACK, len(candles)):
        c = closes[i]
        if c is None:
            continue
        # 추세 필터: 종가가 SMA50 위 또는 SMA50 대비 5% 이내
        s50 = sma50[i]
        if s50 is not None and float(c) < float(s50) * 0.95:
            continue

        patterns = _detect_patterns_at(highs, lows, closes, volumes, i)
        if not patterns:
            continue

        close_pct = pct_change(c, closes[i - 1])
        if close_pct is None or close_pct == 0:
            continue

        base = _vcp_base_context(highs, closes, i)
        if not base:
            continue
        peak, _, pullback_pct = base
        pivot = _pivot_high(highs, i, PIVOT_DAYS)
        r10 = _window_range_pct(highs, lows, closes, i, 10)

        for pattern in patterns:
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
                "peakPrice": round(peak, 4),
                "pullbackPct": round(pullback_pct, 2),
                "pivotHigh": round(float(pivot), 4) if pivot is not None else None,
                "range10Pct": round(r10, 2) if r10 is not None else None,
            }
            if s50 is not None:
                sig["sma50"] = round(float(s50), 4)
            attach_follow_up(sig, candles, i)
            signals.append(sig)

    return signals
