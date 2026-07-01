"""Stock strategy scan engine — active / recent signals, follow-up, payload."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Callable
from zoneinfo import ZoneInfo

from recommend2_bottom_accumulation import (
    is_kr_market_open,
    is_us_market_open,
    yfinance_history_end_str,
    yfinance_history_start_str,
)

from stock_strategy_universes import (
    KR_MARKET_KEYS,
    MARKET_EXCHANGE_LABELS,
    NY,
    RECENT_DAYS,
    US_MARKET_KEYS,
    market_configs,
)

from stock_strategy_record import compute_match_stats

DetectFn = Callable[
    [str, str, list[dict[str, Any]], str, str],
    list[dict[str, Any]],
]


def direction_match_label(day_return_pct: float) -> str:
    return "일치" if day_return_pct > 0 else "불일치"


def attach_follow_up(
    sig: dict[str, Any],
    candles: list[dict[str, Any]],
    signal_index: int,
) -> None:
    if signal_index + 1 >= len(candles):
        return
    d1 = candles[signal_index]
    d_next = candles[signal_index + 1]
    sig_close = d1.get("close")
    next_close = d_next.get("close")
    if sig_close is None or next_close is None or sig_close == 0:
        return
    day_return = ((float(next_close) / float(sig_close)) - 1.0) * 100.0
    sig["nextDate"] = d_next.get("time")
    sig["nextClose"] = next_close
    sig["dayReturnPct"] = round(day_return, 4)
    sig["directionMatch"] = direction_match_label(day_return)


def _resolve_analysis_date(candle_ends: list[str]) -> str | None:
    if not candle_ends:
        return None
    return max(candle_ends)


def scan_market_universe(
    fetch_chart: Callable[..., dict[str, Any]],
    config: dict[str, Any],
    detect_fn: DetectFn,
    *,
    period: str = "6mo",
    after_scheduled_update: bool | None = None,
) -> dict[str, Any]:
    market_id = config["id"]
    universe: list[tuple[str, str]] = config["universe"]
    tz: ZoneInfo = config["timezone"]
    recent_days: int = config.get("recentDays", RECENT_DAYS)
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
                detect_fn(ticker, name, candles, market_id, currency)
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
            s for s in all_signals if analysis_date and s.get("signalDate") == analysis_date
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
        s
        for s in all_signals
        if s.get("signalDate") and str(s["signalDate"]) >= str(cutoff)
    ]

    match_stats = compute_match_stats(recent_signals)

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
        "allSignals": all_signals,
        "matchStats": match_stats,
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
    active_label: str,
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
        phase_hint = f"당일 봉 기준 · {active_label}"
    elif is_fallback:
        phase = "장 마감"
        phase_hint = f"최근 신호일 {display or '—'} (당일 신호 없음)"
    else:
        phase = "장 마감"
        phase_hint = f"종가 기준 T-1={analysis or '—'}"

    return {
        "marketOpen": market_open,
        "sessionLabel": session_label,
        "timezone": timezone_label,
        "phase": phase,
        "phaseHint": phase_hint,
        "analysisDate": analysis,
        "displayDate": display,
        "isFallback": is_fallback,
        "signals": signals,
        "count": len(signals),
    }


def build_active_by_region(
    markets: dict[str, Any], *, active_label: str = "진입 관찰 구간"
) -> dict[str, Any]:
    kr = _region_active_block(
        markets,
        KR_MARKET_KEYS,
        market_open=is_kr_market_open(),
        session_label="09:00–15:30 KST",
        timezone_label="Asia/Seoul",
        active_label=active_label,
    )
    us = _region_active_block(
        markets,
        US_MARKET_KEYS,
        market_open=is_us_market_open(),
        session_label="09:30–16:00 뉴욕(ET)",
        timezone_label="America/New_York",
        active_label=active_label,
    )
    combined = kr["signals"] + us["signals"]
    return {
        "kr": kr,
        "us": us,
        "combined": combined,
        "count": len(combined),
    }


def finalize_payload(
    markets: dict[str, Any],
    *,
    meta: dict[str, Any],
    active_label: str = "진입 관찰 구간",
) -> dict[str, Any]:
    active_by_region = build_active_by_region(markets, active_label=active_label)
    kospi = markets.get("kospi") or {}
    now_utc = datetime.now(timezone.utc)
    now_ny = now_utc.astimezone(NY)
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
    payload["universeSize"] = kospi.get("universeSize", 50)
    payload["updatedAtNy"] = now_ny.isoformat()
    payload["displayTimezone"] = "America/New_York"
    return payload


def collect_strategy_scan(
    strategy_id: str,
    detect_fn: DetectFn,
    fetch_chart: Callable[..., dict[str, Any]],
    *,
    period: str = "6mo",
    market_keys: tuple[str, ...] | list[str] | None = None,
    after_scheduled_update: bool | None = None,
    strategy_meta: dict[str, Any] | None = None,
    active_label: str = "진입 관찰 구간",
) -> dict[str, Any]:
    configs = market_configs()
    keys = tuple(market_keys or configs.keys())
    markets: dict[str, Any] = {}
    for key in keys:
        if key not in configs:
            continue
        markets[key] = scan_market_universe(
            fetch_chart,
            configs[key],
            detect_fn,
            period=period,
            after_scheduled_update=after_scheduled_update,
        )

    now_utc = datetime.now(timezone.utc)
    now_ny = now_utc.astimezone(NY)
    sm = strategy_meta or {}
    meta = {
        "version": 1,
        "strategyId": strategy_id,
        "source": "live",
        "savedAt": now_utc.isoformat(),
        "updatedAt": now_utc.isoformat(),
        "updatedAtNy": now_ny.isoformat(),
        "displayTimezone": "America/New_York",
        "updateSchedule": sm.get("updateSchedule"),
        "universe": sm.get("universe"),
        "strategy": strategy_meta,
        "recentDays": RECENT_DAYS,
    }
    return finalize_payload(markets, meta=meta, active_label=active_label)


def make_yfinance_fetcher() -> Callable[..., dict[str, Any]]:
    import yfinance as yf

    from recommend2_bottom_accumulation import KST

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

    def fetch_chart(
        ticker: str,
        period: str = "6mo",
        tz: ZoneInfo | None = None,
        after_scheduled_update: bool | None = None,
    ) -> dict[str, Any]:
        zone = tz or (KST if ticker.endswith((".KS", ".KQ")) else NY)
        hist = yf.Ticker(ticker).history(
            start=yfinance_history_start_str(period, zone),
            end=yfinance_history_end_str(zone, after_scheduled_update=after_scheduled_update),
            interval="1d",
            auto_adjust=False,
        )
        candles: list[dict[str, Any]] = []
        if hist is not None and not hist.empty:
            for idx, row in hist.iterrows():
                close = _safe_float(row.get("Close"))
                if close is None:
                    continue
                open_px = _safe_float(row.get("Open")) or close
                high_px = _safe_float(row.get("High")) or close
                low_px = _safe_float(row.get("Low")) or close
                vol = _safe_float(row.get("Volume")) or 0.0
                ts = idx.to_pydatetime()
                candles.append(
                    {
                        "time": ts.strftime("%Y-%m-%d"),
                        "open": open_px,
                        "high": high_px,
                        "low": low_px,
                        "close": close,
                        "volume": vol,
                    }
                )
        return {"candles": candles}

    return fetch_chart
