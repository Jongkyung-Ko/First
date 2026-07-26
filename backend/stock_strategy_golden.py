"""골든크로스 + 이동평균 정배열 전략."""

from __future__ import annotations

from typing import Any

from stock_strategy_engine import attach_follow_up
from stock_strategy_indicators import candle_closes, pct_change, sma
from stock_strategy_universes import GLOBAL_UPDATE_SCHEDULE, UNIVERSE_LIMIT

STRATEGY_ID = "golden-cross"
ACTIVE_LABEL = "지금 진입·매집 관찰 구간"

STRATEGY_META: dict[str, Any] = {
    "id": STRATEGY_ID,
    "title": "골든크로스",
    "universe": f"KOSPI·KOSDAQ·NASDAQ·NYSE 각 TOP {UNIVERSE_LIMIT}",
    "updateSchedule": GLOBAL_UPDATE_SCHEDULE,
    "summary": "이동평균선 정배열(종가 > SMA5 > SMA20 > SMA60)과 최근 5거래일 내 SMA5·SMA20 골든크로스를 포착합니다.",
    "rules": [
        "한국: 매일 18:00 KST · 미국: 매일 18:00 뉴욕(ET) 스냅샷 갱신",
        f"유니버스: 시가총액 TOP {UNIVERSE_LIMIT} (시장별)",
        "정배열: 종가 > SMA5 > SMA20 > SMA60",
        "골든크로스: 최근 5거래일 내 SMA5가 SMA20을 상향 돌파",
        "강한 신호: 정배열 + 골든크로스 동시 충족",
        f"최근 {14}일 신호 · 익일 수익률·방향 일치 여부 표시",
        "갱신·표시 시각: 뉴욕(ET) 기준 통일",
    ],
    "patterns": [
        {
            "id": "strong",
            "label": "강한 신호 · 정배열 + 골든크로스",
            "description": "추세 정렬과 단기 골든크로스가 동시에 나타난 구간",
        },
        {
            "id": "align",
            "label": "정배열 유지",
            "description": "이동평균 정배열만 충족 (골든크로스는 5일 이전)",
        },
        {
            "id": "golden",
            "label": "골든크로스",
            "description": "최근 5일 내 5·20 골든크로스 (정배열 미충족)",
        },
    ],
    "disclaimer": "과거 신호·참고용이며 투자 권유가 아닙니다. 일치 = 익거래일 상승.",
}


def _golden_within(sma5: list, sma20: list, i: int, lookback: int = 5) -> bool:
    for j in range(max(1, i - lookback + 1), i + 1):
        p5, c5 = sma5[j - 1], sma5[j]
        p20, c20 = sma20[j - 1], sma20[j]
        if None in (p5, c5, p20, c20):
            continue
        if float(p5) <= float(p20) and float(c5) > float(c20):
            return True
    return False


def _pattern_label(pattern: str) -> str:
    return {
        "strong": "정배열+골든크로스",
        "align": "정배열",
        "golden": "골든크로스",
    }.get(pattern, pattern)


def detect_signals_from_candles(
    ticker: str,
    name: str,
    candles: list[dict[str, Any]],
    market: str = "kospi",
    currency: str = "KRW",
) -> list[dict[str, Any]]:
    if len(candles) < 61:
        return []
    closes = candle_closes(candles)
    sma5 = sma(closes, 5)
    sma20 = sma(closes, 20)
    sma60 = sma(closes, 60)
    signals: list[dict[str, Any]] = []

    for i in range(60, len(candles)):
        c = closes[i]
        s5, s20, s60 = sma5[i], sma20[i], sma60[i]
        if None in (c, s5, s20, s60):
            continue
        alignment = float(c) > float(s5) > float(s20) > float(s60)
        golden = _golden_within(sma5, sma20, i)
        if not alignment and not golden:
            continue
        if alignment and golden:
            pattern = "strong"
        elif alignment:
            pattern = "align"
        else:
            pattern = "golden"
        close_pct = pct_change(closes[i], closes[i - 1])
        if close_pct is None or close_pct == 0:
            continue
        sig: dict[str, Any] = {
            "market": market,
            "currency": currency,
            "pattern": pattern,
            "patternLabel": _pattern_label(pattern),
            "ticker": ticker,
            "name": name,
            "signalDate": candles[i].get("time"),
            "close": c,
            "closePct": round(close_pct, 4),
            "up": close_pct > 0,
            "sma5": round(float(s5), 4),
            "sma20": round(float(s20), 4),
            "sma60": round(float(s60), 4),
        }
        attach_follow_up(sig, candles, i)
        signals.append(sig)
    return signals
