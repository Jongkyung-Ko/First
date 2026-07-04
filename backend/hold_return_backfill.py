"""Backfill holdDay2~5ReturnPct on existing strategy / recommend2 snapshot signals."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from stock_strategy_engine import attach_follow_up, make_yfinance_fetcher
from stock_strategy_record import compute_match_stats
from stock_strategy_universes import ALL_MARKET_KEYS, market_configs


def _signal_date(sig: dict[str, Any]) -> str:
    return str(sig.get("signalDate") or "")[:10]


def _candle_index_by_date(candles: list[dict[str, Any]], signal_date: str) -> int | None:
    target = str(signal_date)[:10]
    if not target:
        return None
    for i, candle in enumerate(candles):
        day = str(candle.get("time") or "")[:10]
        if day == target:
            return i
    return None


def _series_index_by_date(series: list[dict[str, Any]], signal_date: str) -> int | None:
    target = str(signal_date)[:10]
    if not target:
        return None
    for i, row in enumerate(series):
        day = str(row.get("date") or "")[:10]
        if day == target:
            return i
    return None


def enrich_signal_hold_returns_candles(sig: dict[str, Any], candles: list[dict[str, Any]]) -> bool:
    idx = _candle_index_by_date(candles, _signal_date(sig))
    if idx is None:
        return False
    attach_follow_up(sig, candles, idx)
    return any(sig.get(f"holdDay{d}ReturnPct") is not None for d in range(2, 6))


def enrich_signal_hold_returns_recommend2(sig: dict[str, Any], candles: list[dict[str, Any]]) -> bool:
    from recommend2_bottom_accumulation import _attach_follow_up, _build_series

    series = _build_series(candles)
    idx = _series_index_by_date(series, _signal_date(sig))
    if idx is None:
        return False
    _attach_follow_up(sig, series, idx)
    return any(sig.get(f"holdDay{d}ReturnPct") is not None for d in range(2, 6))


def _iter_signal_lists(block: dict[str, Any]) -> list[list[dict[str, Any]]]:
    keys = ("recentSignals", "activeSignals", "allSignals")
    return [block[k] for k in keys if isinstance(block.get(k), list)]


def backfill_payload_hold_returns(
    payload: dict[str, Any],
    fetch_chart: Callable[..., dict[str, Any]],
    *,
    lookback_days: int | None = 14,
    use_recommend2_series: bool = False,
) -> dict[str, Any]:
    """In-place enrich copy; returns stats."""
    payload = deepcopy(payload)
    markets = payload.get("markets") or {}
    configs = market_configs()
    cutoff = None
    if lookback_days is not None and lookback_days > 0:
        cutoff = (datetime.now(timezone.utc).date() - timedelta(days=lookback_days)).isoformat()

    chart_cache: dict[tuple[str, str], list[dict[str, Any]]] = {}
    touched_signals = 0
    enriched_signals = 0

    for market_id in ALL_MARKET_KEYS:
        block = markets.get(market_id)
        if not isinstance(block, dict):
            continue
        cfg = configs.get(market_id) or {}
        tz = cfg.get("timezone")

        for sig_list in _iter_signal_lists(block):
            for sig in sig_list:
                if not isinstance(sig, dict):
                    continue
                sd = _signal_date(sig)
                if cutoff and sd and sd < cutoff:
                    continue
                ticker = str(sig.get("ticker") or "")
                if not ticker:
                    continue
                cache_key = (ticker, market_id)
                if cache_key not in chart_cache:
                    try:
                        chart_cache[cache_key] = (
                            fetch_chart(
                                ticker,
                                "6mo",
                                tz=tz,
                                after_scheduled_update=True,
                            ).get("candles")
                            or []
                        )
                    except Exception:
                        chart_cache[cache_key] = []

                touched_signals += 1
                enrich_fn = (
                    enrich_signal_hold_returns_recommend2
                    if use_recommend2_series
                    else enrich_signal_hold_returns_candles
                )
                if enrich_fn(sig, chart_cache[cache_key]):
                    enriched_signals += 1

        recent = block.get("recentSignals")
        if isinstance(recent, list):
            block["matchStats"] = compute_match_stats(recent)

    now = datetime.now(timezone.utc).isoformat()
    payload["updatedAt"] = now
    payload["holdReturnBackfillAt"] = now
    return {
        "payload": payload,
        "touchedSignals": touched_signals,
        "enrichedSignals": enriched_signals,
    }


def backfill_strategy_snapshots(
    *,
    lookback_days: int = 14,
    save_disk: bool = True,
    save_supabase: bool = True,
) -> list[dict[str, Any]]:
    from stock_strategy_snapshot import STRATEGY_REGISTRY, load_snapshot, save_strategy_snapshot_disk

    fetch = make_yfinance_fetcher()
    results: list[dict[str, Any]] = []

    for strategy_id in STRATEGY_REGISTRY:
        from stock_snapshot_store import load_global_snapshot

        payload = load_global_snapshot(strategy_id) or load_snapshot(strategy_id, use_memory=False)
        if not payload or not payload.get("markets"):
            results.append({"strategyId": strategy_id, "skipped": True, "reason": "no snapshot"})
            continue
        out = backfill_payload_hold_returns(payload, fetch, lookback_days=lookback_days)
        new_payload = out["payload"]
        if save_disk or save_supabase:
            save_strategy_snapshot_disk(strategy_id, new_payload)
        results.append(
            {
                "strategyId": strategy_id,
                "touchedSignals": out["touchedSignals"],
                "enrichedSignals": out["enrichedSignals"],
            }
        )
    return results


def backfill_recommend2_snapshot(
    *,
    lookback_days: int = 14,
    save_disk: bool = True,
    save_supabase: bool = True,
) -> dict[str, Any]:
    from recommend2_snapshot import load_snapshot, save_snapshot
    from stock_snapshot_store import load_global_snapshot

    fetch = make_yfinance_fetcher()
    payload = load_global_snapshot("recommend2") or load_snapshot()
    if not payload or not payload.get("markets"):
        return {"strategyId": "recommend2", "skipped": True, "reason": "no snapshot"}

    out = backfill_payload_hold_returns(
        payload,
        fetch,
        lookback_days=lookback_days,
        use_recommend2_series=True,
    )
    new_payload = out["payload"]
    if save_disk or save_supabase:
        save_snapshot(new_payload)
    return {
        "strategyId": "recommend2",
        "touchedSignals": out["touchedSignals"],
        "enrichedSignals": out["enrichedSignals"],
    }
