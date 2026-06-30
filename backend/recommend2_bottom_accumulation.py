"""추천2 — KOSPI TOP50 바닥매집 신호 스캔."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

VOL_MIN = 10.0
VOL_MAX = 30.0
RECENT_SIGNAL_DAYS = 14
KST = ZoneInfo("Asia/Seoul")
UPDATE_SCHEDULE = "매일 18:00 (KST) · 장 마감(15:30) 후 T-2·T-1 분석"

KOSPI_TOP_50: list[tuple[str, str]] = [
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
    ("011070.KS", "LG이노텍"),
    ("006800.KS", "미래에셋증권"),
    ("010130.KS", "고려아연"),
    ("000150.KS", "두산"),
    ("015760.KS", "한국전력"),
    ("051910.KS", "LG화학"),
    ("010140.KS", "삼성중공업"),
    ("064350.KS", "현대로템"),
    ("316140.KS", "우리금융지주"),
    ("017670.KS", "SK텔레콤"),
    ("079550.KS", "LIG넥스원"),
    ("011200.KS", "HMM"),
    ("267250.KS", "HD현대"),
    ("272210.KS", "한화시스템"),
    ("033780.KS", "KT&G"),
    ("138040.KS", "메리츠금융지주"),
    ("307950.KS", "현대오토에버"),
    ("003670.KS", "포스코퓨처엠"),
    ("047810.KS", "한국항공우주"),
    ("010950.KS", "S-Oil"),
]

STRATEGY_META: dict[str, Any] = {
    "id": "bottom-accumulation",
    "title": "바닥매집",
    "universe": "KOSPI 시가총액 TOP 50",
    "summary": "거래량이 단계적으로 늘면서 SMA5가 하락(또는 반등 전환)한 뒤 나타나는 매집 구간을 포착합니다.",
    "rules": [
        "업데이트: 매일 18:00 (KST) — 당일 장 마감(15:30) 데이터 반영",
        "T-1 = 분석 기준 최신 거래일 · T-2 = 그 전 거래일 (예: 6/30 분석 → T-2=6/29, T-1=6/30)",
        "공통: T-2·T-1 거래량 전일 대비 +10%~+30% 연속 2일",
        "패턴 A: T-2·T-1 SMA5 등락비율 모두 < 0 (연속 하락)",
        "패턴 B: T-2 SMA5 < 0, T-1 SMA5 > 0 (하락 후 상승 전환)",
        "매집 신호 = T-2·T-1 조건 충족 시 T-1 종가 기준으로 표시",
    ],
    "patterns": [
        {
            "id": "A",
            "label": "패턴 A · SMA5 연속 2일 하락",
            "description": "거래량 +10~30% 2일 + SMA5 T-2·T-1 모두 하락 → T-1일 매집 신호",
        },
        {
            "id": "B",
            "label": "패턴 B · SMA5 하락 후 반등",
            "description": "거래량 +10~30% 2일 + SMA5 T-2 하락 · T-1 상승 전환 → T-1일 매집 신호",
        },
    ],
    "backtest": {
        "period": "최근 6개월",
        "universe": "KOSPI TOP 50",
        "A": {
            "signals": 34,
            "winRate": "64.7%",
            "avgReturn": "+2.61%",
            "upDayAvg": "+5.23%",
            "downDayAvg": "-2.20%",
        },
        "B": {
            "signals": 12,
            "winRate": "75.0%",
            "avgReturn": "+2.45%",
            "upDayAvg": "+3.70%",
            "downDayAvg": "-1.31%",
        },
    },
    "disclaimer": "과거 백테스트·참고용이며 투자 권유가 아닙니다.",
}


def _pct_change(curr: float | None, prev: float | None) -> float | None:
    if curr is None or prev is None or prev == 0:
        return None
    return ((curr / prev) - 1.0) * 100.0


def _sma(values: list[float | None], period: int) -> list[float | None]:
    out: list[float | None] = [None] * len(values)
    for i in range(period - 1, len(values)):
        window = values[i - period + 1 : i + 1]
        if any(v is None for v in window):
            continue
        out[i] = sum(window) / period  # type: ignore[arg-type]
    return out


def _build_series(candles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    closes = [c.get("close") for c in candles]
    volumes = [c.get("volume") for c in candles]
    sma5 = _sma(closes, 5)
    series: list[dict[str, Any]] = []

    for i, candle in enumerate(candles):
        prev = i - 1
        vol_pct = _pct_change(volumes[i], volumes[prev] if prev >= 0 else None)
        sma5_pct = _pct_change(sma5[i], sma5[prev] if prev >= 0 else None)
        close_pct = _pct_change(closes[i], closes[prev] if prev >= 0 else None)
        series.append(
            {
                "date": candle.get("time"),
                "close": closes[i],
                "volume": volumes[i],
                "volPct": vol_pct,
                "sma5Pct": sma5_pct,
                "closePct": close_pct,
            }
        )
    return series


def _vol_in_band(day: dict[str, Any]) -> bool:
    vol = day.get("volPct")
    return vol is not None and VOL_MIN <= vol < VOL_MAX


def _classify_pattern(d2: dict[str, Any], d1: dict[str, Any]) -> str | None:
    if not _vol_in_band(d2) or not _vol_in_band(d1):
        return None
    s2 = d2.get("sma5Pct")
    s1 = d1.get("sma5Pct")
    if s2 is None or s1 is None:
        return None
    if s2 < 0 and s1 < 0:
        return "A"
    if s2 < 0 and s1 > 0:
        return "B"
    return None


def _signal_from_index(
    series: list[dict[str, Any]], i: int, ticker: str, name: str, pattern: str
) -> dict[str, Any] | None:
    """T-2 = series[i-1], T-1 = series[i] (분석일 최신 거래일)."""
    if i < 1:
        return None
    d2 = series[i - 1]
    d1 = series[i]
    close_pct = d1.get("closePct")
    if close_pct is None or close_pct == 0:
        return None
    if _classify_pattern(d2, d1) != pattern:
        return None
    return {
        "pattern": pattern,
        "patternLabel": "패턴 A" if pattern == "A" else "패턴 B",
        "ticker": ticker,
        "name": name,
        "signalDate": d1.get("date"),
        "day2": d2.get("date"),
        "day1": d1.get("date"),
        "vol2": round(d2.get("volPct"), 4),
        "vol1": round(d1.get("volPct"), 4),
        "sma5_2": round(d2.get("sma5Pct"), 4),
        "sma5_1": round(d1.get("sma5Pct"), 4),
        "close": d1.get("close"),
        "closePct": round(close_pct, 4),
        "up": close_pct > 0,
    }


def detect_signals_from_candles(
    ticker: str, name: str, candles: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    if len(candles) < 2:
        return []
    series = _build_series(candles)
    signals: list[dict[str, Any]] = []
    for i in range(1, len(series)):
        for pattern in ("A", "B"):
            sig = _signal_from_index(series, i, ticker, name, pattern)
            if sig:
                signals.append(sig)
    return signals


def _resolve_analysis_date(candle_ends: list[str]) -> str | None:
    if not candle_ends:
        return None
    return max(candle_ends)


def collect_bottom_accumulation(
    fetch_chart,
    *,
    period: str = "3mo",
) -> dict[str, Any]:
    """Scan KOSPI TOP50; fetch_chart(ticker) -> {candles: [...]}."""
    now_kst = datetime.now(KST)
    now = now_kst.astimezone(timezone.utc)
    cutoff = (now_kst - timedelta(days=RECENT_SIGNAL_DAYS)).date()
    all_signals: list[dict[str, Any]] = []
    errors: list[str] = []
    candle_ends: list[str] = []

    for ticker, name in KOSPI_TOP_50:
        try:
            payload = fetch_chart(ticker, period)
            candles = payload.get("candles") or []
            if candles:
                last_time = candles[-1].get("time")
                if last_time:
                    candle_ends.append(str(last_time)[:10])
            all_signals.extend(detect_signals_from_candles(ticker, name, candles))
        except Exception as exc:
            errors.append(f"{ticker}: {exc}")

    all_signals.sort(key=lambda s: (s.get("signalDate") or "", s.get("ticker") or ""))

    analysis_date = _resolve_analysis_date(candle_ends)
    active_signals = [
        s for s in all_signals if analysis_date and s.get("day1") == analysis_date
    ]
    recent_signals = [
        s
        for s in all_signals
        if s.get("signalDate") and s["signalDate"] >= str(cutoff)
    ]

    return {
        "version": 2,
        "updatedAt": now.isoformat(),
        "updatedAtKst": now_kst.isoformat(),
        "updateSchedule": UPDATE_SCHEDULE,
        "analysisDate": analysis_date,
        "timezone": "Asia/Seoul",
        "strategy": STRATEGY_META,
        "latestSignalDate": analysis_date,
        "activeSignals": active_signals,
        "recentSignals": recent_signals,
        "activeCount": len(active_signals),
        "recentCount": len(recent_signals),
        "scanErrors": errors[:5],
        "universeSize": len(KOSPI_TOP_50),
    }
