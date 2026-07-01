"""추천2 — KOSPI / NASDAQ / NYSE 바닥매집 신호 스캔."""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from typing import Any, Callable
from zoneinfo import ZoneInfo

from kr_market_universes import KOSDAQ_TOP_100, KOSPI_TOP_100
from us_market_universes import NASDAQ_TOP_100, NYSE_TOP_100

VOL_MIN = 10.0
VOL_MAX = 30.0
KST = ZoneInfo("Asia/Seoul")
ET = ZoneInfo("America/New_York")
KOSPI_RECENT_DAYS = 14
KOSDAQ_RECENT_DAYS = 14
NASDAQ_RECENT_DAYS = 14
NYSE_RECENT_DAYS = 14
SCHEDULED_UPDATE_HOUR = 18
KOSPI_UPDATE_SCHEDULE = "매일 18:00 (KST) · 장 마감(15:30) 후 T-2·T-1 분석"
US_UPDATE_SCHEDULE = "매일 18:00 (ET) · 장 마감(16:00) 후 T-2·T-1 분석"
UPDATE_SCHEDULE = KOSPI_UPDATE_SCHEDULE
KR_MARKET_KEYS = ("kospi", "kosdaq")
US_MARKET_KEYS = ("nasdaq", "nyse")
MARKET_EXCHANGE_LABELS = {
    "kospi": "KOSPI",
    "kosdaq": "KOSDAQ",
    "nasdaq": "NASDAQ",
    "nyse": "NYSE",
}

STRATEGY_META: dict[str, Any] = {
    "id": "bottom-accumulation",
    "title": "바닥매집",
    "universe": "KOSPI TOP 100 · KOSDAQ TOP 100 · NASDAQ-100 · NYSE TOP 100",
    "summary": "거래량이 단계적으로 늘면서 SMA5가 하락(또는 반등 전환)한 뒤 나타나는 매집 구간을 포착합니다.",
    "rules": [
        "KOSPI: 매일 18:00 (KST) — 당일 장 마감(15:30) 데이터 반영",
        "NASDAQ·NYSE: 매일 18:00 (ET) — 당일 장 마감(16:00) 데이터 반영",
        "최신 매집: KOSPI·KOSDAQ·NASDAQ·NYSE 통합 · 한국/미국 장중·종가 기준 T-2·T-1",
        "18:00 현지 시각 이전 Re/조회: T-1 = 전 거래일 · 18:00 이후: T-1 = 당일 종가(장 마감 반영)",
        "공통: T-2·T-1 거래량 전일 대비 +10%~+30% 연속 2일 (양 끝 포함)",
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
        "universe": "KOSPI TOP 100",
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

MARKET_CONFIGS: dict[str, dict[str, Any]] = {
    "kospi": {
        "id": "kospi",
        "title": "KOSPI TOP 100",
        "universe": KOSPI_TOP_100,
        "timezone": KST,
        "updateSchedule": KOSPI_UPDATE_SCHEDULE,
        "recentDays": KOSPI_RECENT_DAYS,
        "includeActive": True,
        "currency": "KRW",
    },
    "kosdaq": {
        "id": "kosdaq",
        "title": "KOSDAQ TOP 100",
        "universe": KOSDAQ_TOP_100,
        "timezone": KST,
        "updateSchedule": KOSPI_UPDATE_SCHEDULE,
        "recentDays": KOSDAQ_RECENT_DAYS,
        "includeActive": True,
        "currency": "KRW",
    },
    "nasdaq": {
        "id": "nasdaq",
        "title": "NASDAQ TOP 100",
        "universe": NASDAQ_TOP_100,
        "timezone": ET,
        "updateSchedule": US_UPDATE_SCHEDULE,
        "recentDays": NASDAQ_RECENT_DAYS,
        "includeActive": True,
        "currency": "USD",
    },
    "nyse": {
        "id": "nyse",
        "title": "NYSE TOP 100",
        "universe": NYSE_TOP_100,
        "timezone": ET,
        "updateSchedule": US_UPDATE_SCHEDULE,
        "recentDays": NYSE_RECENT_DAYS,
        "includeActive": True,
        "currency": "USD",
    },
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
    return vol is not None and VOL_MIN <= vol <= VOL_MAX


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


def _direction_match_label(day_return_pct: float) -> str:
    """바닥매집: 익 거래일 상승이면 일치, 하락·보합이면 불일치."""
    return "일치" if day_return_pct > 0 else "불일치"


def _attach_follow_up(sig: dict[str, Any], d1: dict[str, Any], d_next: dict[str, Any] | None) -> None:
    if not d_next:
        return
    sig_close = d1.get("close")
    next_close = d_next.get("close")
    if sig_close is None or next_close is None or sig_close == 0:
        return
    day_return = ((float(next_close) / float(sig_close)) - 1.0) * 100.0
    sig["nextDate"] = d_next.get("date")
    sig["nextClose"] = next_close
    sig["dayReturnPct"] = round(day_return, 4)
    sig["directionMatch"] = _direction_match_label(day_return)


def _signal_from_index(
    series: list[dict[str, Any]],
    i: int,
    ticker: str,
    name: str,
    pattern: str,
    *,
    market: str,
    currency: str,
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
    sig: dict[str, Any] = {
        "market": market,
        "currency": currency,
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
    d_next = series[i + 1] if i + 1 < len(series) else None
    _attach_follow_up(sig, d1, d_next)
    return sig


def detect_signals_from_candles(
    ticker: str,
    name: str,
    candles: list[dict[str, Any]],
    *,
    market: str = "kospi",
    currency: str = "KRW",
) -> list[dict[str, Any]]:
    if len(candles) < 2:
        return []
    series = _build_series(candles)
    signals: list[dict[str, Any]] = []
    for i in range(1, len(series)):
        for pattern in ("A", "B"):
            sig = _signal_from_index(
                series, i, ticker, name, pattern, market=market, currency=currency
            )
            if sig:
                signals.append(sig)
    return signals


def _after_scheduled_update(now: datetime, hour: int = SCHEDULED_UPDATE_HOUR) -> bool:
    return now.hour > hour or (now.hour == hour and now.minute >= 0)


def is_kr_market_open(now: datetime | None = None) -> bool:
    """한국 정규장 09:00–15:30 KST (주말 제외)."""
    now = now or datetime.now(KST)
    if now.tzinfo is None:
        now = now.replace(tzinfo=KST)
    else:
        now = now.astimezone(KST)
    if now.weekday() >= 5:
        return False
    t = now.time()
    return time(9, 0) <= t <= time(15, 30)


def is_us_market_open(now: datetime | None = None) -> bool:
    """미국 정규장 09:30–16:00 ET (주말 제외)."""
    now = now or datetime.now(ET)
    if now.tzinfo is None:
        now = now.replace(tzinfo=ET)
    else:
        now = now.astimezone(ET)
    if now.weekday() >= 5:
        return False
    t = now.time()
    return time(9, 30) <= t <= time(16, 0)


def should_include_today_bar(
    tz: ZoneInfo,
    *,
    after_scheduled_update: bool | None = None,
    as_of: datetime | None = None,
) -> bool:
    """장중이면 당일 봉 포함, 18:00 이후 정규 갱신이면 당일 봉, 그 외 전일까지."""
    now = as_of or datetime.now(tz)
    if now.tzinfo is None:
        now = now.replace(tzinfo=tz)
    else:
        now = now.astimezone(tz)
    if tz == KST and is_kr_market_open(now):
        return True
    if tz == ET and is_us_market_open(now):
        return True
    if after_scheduled_update is not None:
        return after_scheduled_update
    return _after_scheduled_update(now)


def yfinance_history_end_str(
    tz: ZoneInfo | None = None,
    *,
    as_of: datetime | None = None,
    after_scheduled_update: bool | None = None,
) -> str:
    """yfinance end (exclusive).

  18:00 현지 시각 이전: 당일 일봉 제외 → T-1 = 전 거래일.
  18:00 이후(또는 정규 배치): 당일 일봉 포함 → T-1 = 당일 종가.
    """
    zone = tz or KST
    now = as_of or datetime.now(zone)
    if now.tzinfo is None:
        now = now.replace(tzinfo=zone)
    else:
        now = now.astimezone(zone)

    include_today = should_include_today_bar(
        zone,
        after_scheduled_update=after_scheduled_update,
        as_of=now,
    )
    d = now.date()
    if include_today:
        return (d + timedelta(days=1)).isoformat()
    return d.isoformat()


def yfinance_history_start_str(period: str, tz: ZoneInfo | None = None) -> str:
    """yfinance start for period."""
    zone = tz or KST
    days = {
        "1mo": 31,
        "3mo": 92,
        "6mo": 183,
        "1y": 366,
        "2y": 730,
        "5y": 1826,
        "10y": 3653,
    }.get(period, 92)
    return (datetime.now(zone).date() - timedelta(days=days)).isoformat()


def _resolve_analysis_date(candle_ends: list[str]) -> str | None:
    if not candle_ends:
        return None
    return max(candle_ends)


def scan_market_universe(
    fetch_chart: Callable[..., dict[str, Any]],
    config: dict[str, Any],
    *,
    period: str = "3mo",
    after_scheduled_update: bool | None = None,
) -> dict[str, Any]:
    market_id = config["id"]
    universe: list[tuple[str, str]] = config["universe"]
    tz: ZoneInfo = config["timezone"]
    recent_days: int = config["recentDays"]
    include_active: bool = config.get("includeActive", False)
    currency: str = config.get("currency", "USD")

    now_local = datetime.now(tz)
    cutoff = (now_local - timedelta(days=recent_days)).date()
    all_signals: list[dict[str, Any]] = []
    errors: list[str] = []
    candle_ends: list[str] = []

    for ticker, name in universe:
        try:
            payload = fetch_chart(
                ticker,
                period,
                tz=tz,
                after_scheduled_update=after_scheduled_update,
            )
            candles = payload.get("candles") or []
            if candles:
                last_time = candles[-1].get("time")
                if last_time:
                    candle_ends.append(str(last_time)[:10])
            all_signals.extend(
                detect_signals_from_candles(
                    ticker, name, candles, market=market_id, currency=currency
                )
            )
        except Exception as exc:
            errors.append(f"{ticker}: {exc}")

    all_signals.sort(key=lambda s: (s.get("signalDate") or "", s.get("ticker") or ""))

    analysis_date = _resolve_analysis_date(candle_ends)
    active_signals: list[dict[str, Any]] = []
    active_is_fallback = False
    active_display_date = analysis_date

    if include_active:
        active_signals = [
            s for s in all_signals if analysis_date and s.get("day1") == analysis_date
        ]
        if not active_signals and analysis_date:
            on_or_before = [
                s
                for s in all_signals
                if s.get("signalDate") and str(s["signalDate"]) <= analysis_date
            ]
            if on_or_before:
                batch_date = max(str(s["signalDate"]) for s in on_or_before)
                active_signals = [
                    s for s in on_or_before if str(s.get("signalDate")) == batch_date
                ]
                active_is_fallback = True
                active_display_date = batch_date

    recent_signals = [
        s for s in all_signals if s.get("signalDate") and s["signalDate"] >= str(cutoff)
    ]

    return {
        "id": market_id,
        "title": config["title"],
        "timezone": str(tz),
        "updateSchedule": config["updateSchedule"],
        "analysisDate": analysis_date,
        "latestSignalDate": active_display_date or analysis_date,
        "activeSignals": active_signals,
        "activeDisplayDate": active_display_date,
        "activeIsFallback": active_is_fallback,
        "recentSignals": recent_signals,
        "activeCount": len(active_signals),
        "recentCount": len(recent_signals),
        "recentDays": recent_days,
        "scanErrors": errors[:5],
        "universeSize": len(universe),
        "currency": currency,
    }


def _region_active_block(
    markets: dict[str, Any],
    market_keys: tuple[str, ...],
    *,
    market_open: bool,
    session_label: str,
    timezone_label: str,
) -> dict[str, Any]:
    signals: list[dict[str, Any]] = []
    analysis_dates: list[str] = []
    display_dates: list[str] = []
    is_fallback = False

    for key in market_keys:
        block = markets.get(key) or {}
        if block.get("analysisDate"):
            analysis_dates.append(str(block["analysisDate"]))
        if block.get("activeDisplayDate"):
            display_dates.append(str(block["activeDisplayDate"]))
        if block.get("activeIsFallback"):
            is_fallback = True
        label = MARKET_EXCHANGE_LABELS.get(key, key.upper())
        for sig in block.get("activeSignals") or []:
            row = dict(sig)
            row["exchange"] = label
            row["segment"] = key
            signals.append(row)

    signals.sort(key=lambda s: (s.get("signalDate") or "", s.get("ticker") or ""))
    analysis = max(analysis_dates) if analysis_dates else None
    display = max(display_dates) if display_dates else analysis

    if market_open:
        phase = "장중"
        phaseHint = "당일 봉 기준 · 매집 관찰 구간"
    elif is_fallback:
        phase = "장 마감"
        phaseHint = f"최근 매집 신호일 {display or '—'} (당일 신호 없음)"
    else:
        phase = "장 마감"
        phaseHint = f"종가 기준 T-1={analysis or '—'}"

    return {
        "marketOpen": market_open,
        "sessionLabel": session_label,
        "timezone": timezone_label,
        "phase": phase,
        "phaseHint": phaseHint,
        "analysisDate": analysis,
        "displayDate": display,
        "isFallback": is_fallback,
        "signals": signals,
        "count": len(signals),
    }


def build_active_by_region(markets: dict[str, Any]) -> dict[str, Any]:
    """KOSPI·KOSDAQ / NASDAQ·NYSE 최신 매집을 지역별로 통합."""
    kr = _region_active_block(
        markets,
        KR_MARKET_KEYS,
        market_open=is_kr_market_open(),
        session_label="09:00–15:30 KST",
        timezone_label="Asia/Seoul",
    )
    us = _region_active_block(
        markets,
        US_MARKET_KEYS,
        market_open=is_us_market_open(),
        session_label="09:30–16:00 ET",
        timezone_label="America/New_York",
    )
    combined = kr["signals"] + us["signals"]
    return {
        "kr": kr,
        "us": us,
        "combined": combined,
        "count": len(combined),
    }


def finalize_payload(markets: dict[str, Any], *, meta: dict[str, Any]) -> dict[str, Any]:
    """시장 스캔 결과 + 메타를 API 응답으로 조립."""
    active_by_region = build_active_by_region(markets)
    kospi = markets.get("kospi") or {}
    payload = dict(meta)
    payload["markets"] = markets
    payload["activeByRegion"] = active_by_region
    payload["activeSignals"] = active_by_region["combined"]
    payload["activeCount"] = active_by_region["count"]
    payload["analysisDate"] = kospi.get("analysisDate")
    payload["latestSignalDate"] = kospi.get("latestSignalDate")
    payload["activeDisplayDate"] = kospi.get("activeDisplayDate")
    payload["activeIsFallback"] = kospi.get("activeIsFallback", False)
    payload["recentSignals"] = kospi.get("recentSignals", [])
    payload["recentCount"] = kospi.get("recentCount", 0)
    payload["scanErrors"] = kospi.get("scanErrors", [])
    payload["universeSize"] = kospi.get("universeSize", 100)
    return payload


def collect_bottom_accumulation(
    fetch_chart,
    *,
    period: str = "3mo",
    market_keys: tuple[str, ...] | list[str] | None = None,
    after_scheduled_update: bool | None = None,
) -> dict[str, Any]:
    """Scan selected markets (default: all)."""
    keys = tuple(market_keys) if market_keys else tuple(MARKET_CONFIGS.keys())
    now_kst = datetime.now(KST)
    now = now_kst.astimezone(timezone.utc)

    markets: dict[str, Any] = {}
    for key in keys:
        config = MARKET_CONFIGS.get(key)
        if not config:
            continue
        tz: ZoneInfo = config["timezone"]
        market_after = after_scheduled_update
        if market_after is None:
            market_after = should_include_today_bar(tz)
        markets[key] = scan_market_universe(
            fetch_chart,
            config,
            period=period,
            after_scheduled_update=market_after,
        )

    meta = {
        "version": 6,
        "updatedAt": now.isoformat(),
        "updatedAtKst": now_kst.isoformat(),
        "updateSchedule": (
            "KOSPI·KOSDAQ 매일 18:00 (KST) · NASDAQ·NYSE 매일 18:00 (ET) · 장중·종가 T-2·T-1"
        ),
        "timezone": "Asia/Seoul",
        "strategy": STRATEGY_META,
    }
    return finalize_payload(markets, meta=meta)
