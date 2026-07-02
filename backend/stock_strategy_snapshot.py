"""Stock strategy snapshots — golden / bollinger / rsi."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from stock_strategy_bollinger import (
    ACTIVE_LABEL as BOLLINGER_ACTIVE_LABEL,
    STRATEGY_ID as BOLLINGER_ID,
    STRATEGY_META as BOLLINGER_META,
    detect_signals_from_candles as detect_bollinger,
)
from stock_strategy_bottom import (
    ACTIVE_LABEL as BOTTOM_ACTIVE_LABEL,
    STRATEGY_ID as BOTTOM_ID,
    STRATEGY_META as BOTTOM_META,
    detect_signals_from_candles as detect_bottom,
)
from stock_strategy_candle_support import (
    ACTIVE_LABEL as CANDLE_ACTIVE_LABEL,
    STRATEGY_ID as CANDLE_ID,
    STRATEGY_META as CANDLE_META,
    detect_signals_from_candles as detect_candle_support,
)
from stock_strategy_obv import (
    ACTIVE_LABEL as OBV_ACTIVE_LABEL,
    STRATEGY_ID as OBV_ID,
    STRATEGY_META as OBV_META,
    detect_signals_from_candles as detect_obv,
)
from stock_strategy_golden import (
    ACTIVE_LABEL as GOLDEN_ACTIVE_LABEL,
    STRATEGY_ID as GOLDEN_ID,
    STRATEGY_META as GOLDEN_META,
    detect_signals_from_candles as detect_golden,
)
from stock_strategy_rsi import (
    ACTIVE_LABEL as RSI_ACTIVE_LABEL,
    STRATEGY_ID as RSI_ID,
    STRATEGY_META as RSI_META,
    detect_signals_from_candles as detect_rsi,
)
from stock_strategy_vcp import (
    ACTIVE_LABEL as VCP_ACTIVE_LABEL,
    STRATEGY_ID as VCP_ID,
    STRATEGY_META as VCP_META,
    detect_signals_from_candles as detect_vcp,
)
from stock_strategy_universes import GLOBAL_UPDATE_SCHEDULE, NY, region_market_keys
from stock_strategy_engine import finalize_payload

ROOT = Path(__file__).resolve().parent.parent

STRATEGY_REGISTRY: dict[str, dict[str, Any]] = {
    GOLDEN_ID: {
        "meta": GOLDEN_META,
        "detect": detect_golden,
        "active_label": GOLDEN_ACTIVE_LABEL,
        "filename": "stock-strategy-golden.json",
    },
    BOLLINGER_ID: {
        "meta": BOLLINGER_META,
        "detect": detect_bollinger,
        "active_label": BOLLINGER_ACTIVE_LABEL,
        "filename": "stock-strategy-bollinger.json",
    },
    RSI_ID: {
        "meta": RSI_META,
        "detect": detect_rsi,
        "active_label": RSI_ACTIVE_LABEL,
        "filename": "stock-strategy-rsi.json",
    },
    CANDLE_ID: {
        "meta": CANDLE_META,
        "detect": detect_candle_support,
        "active_label": CANDLE_ACTIVE_LABEL,
        "filename": "stock-strategy-candle-support.json",
    },
    OBV_ID: {
        "meta": OBV_META,
        "detect": detect_obv,
        "active_label": OBV_ACTIVE_LABEL,
        "filename": "stock-strategy-obv.json",
    },
    BOTTOM_ID: {
        "meta": BOTTOM_META,
        "detect": detect_bottom,
        "active_label": BOTTOM_ACTIVE_LABEL,
        "filename": "stock-strategy-bottom.json",
    },
    VCP_ID: {
        "meta": VCP_META,
        "detect": detect_vcp,
        "active_label": VCP_ACTIVE_LABEL,
        "filename": "stock-strategy-vcp.json",
    },
}

_memory: dict[str, dict[str, Any]] = {}


def snapshot_path(strategy_id: str) -> Path:
    entry = STRATEGY_REGISTRY[strategy_id]
    raw = os.getenv(f"STOCK_STRATEGY_{strategy_id.upper().replace('-', '_')}_PATH", "").strip()
    if raw:
        return Path(raw)
    return ROOT / "data" / entry["filename"]


def _empty_markets() -> dict[str, Any]:
    from stock_strategy_universes import ALL_MARKET_KEYS

    return {key: {} for key in ALL_MARKET_KEYS}


def merge_market_results(
    existing: dict[str, Any] | None,
    fresh: dict[str, Any],
    market_keys: tuple[str, ...],
    *,
    active_label: str,
) -> dict[str, Any]:
    markets = dict((existing or {}).get("markets") or _empty_markets())
    fresh_markets = fresh.get("markets") or {}
    for key in market_keys:
        if key in fresh_markets:
            markets[key] = fresh_markets[key]

    meta = {
        "version": fresh.get("version", 1),
        "strategyId": fresh.get("strategyId"),
        "source": "snapshot",
        "savedAt": fresh.get("savedAt") or datetime.now(timezone.utc).isoformat(),
        "updatedAt": fresh.get("updatedAt"),
        "updatedAtNy": fresh.get("updatedAtNy"),
        "displayTimezone": "America/New_York",
        "updateSchedule": fresh.get("updateSchedule") or GLOBAL_UPDATE_SCHEDULE,
        "universe": fresh.get("universe"),
        "strategy": fresh.get("strategy"),
        "recentDays": fresh.get("recentDays", 14),
    }
    payload = finalize_payload(markets, meta=meta, active_label=active_label)
    regions = (existing or {}).get("regions") or {}
    if isinstance(regions, dict):
        payload["regions"] = dict(regions)
    else:
        payload["regions"] = {}
    for key in market_keys:
        if key in fresh_markets:
            payload["regions"][key] = {
                "updatedAt": fresh.get("updatedAt"),
                "updatedAtNy": fresh.get("updatedAtNy"),
            }
    return payload


def save_strategy_snapshot_disk(strategy_id: str, payload: dict[str, Any]) -> None:
    """전략 스냅샷 메모리·디스크 저장 (신호 strip)."""
    from stock_strategy_record import strip_all_signals_from_payload

    global _memory
    to_save = strip_all_signals_from_payload(payload)
    _memory[strategy_id] = to_save
    path = snapshot_path(strategy_id)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as handle:
            json.dump(to_save, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    except OSError:
        pass


def build_and_save_snapshot(
    strategy_id: str,
    fetch_chart: Callable[..., dict[str, Any]],
    *,
    period: str = "6mo",
    region: str = "all",
    after_scheduled_update: bool | None = True,
) -> dict[str, Any]:
    from stock_strategy_engine import collect_strategy_scan

    entry = STRATEGY_REGISTRY[strategy_id]
    keys = region_market_keys(region)
    universe_limit = entry.get("universe_limit")
    fresh = collect_strategy_scan(
        strategy_id,
        entry["detect"],
        fetch_chart,
        period=period,
        market_keys=keys,
        after_scheduled_update=after_scheduled_update,
        strategy_meta=entry["meta"],
        active_label=entry["active_label"],
        universe_limit=universe_limit,
    )
    existing = load_snapshot(strategy_id, use_memory=False)
    payload = merge_market_results(
        existing,
        fresh,
        keys,
        active_label=entry["active_label"],
    )
    save_strategy_snapshot_disk(strategy_id, payload)
    return payload


def load_snapshot(strategy_id: str, *, use_memory: bool = True) -> dict[str, Any] | None:
    if use_memory and strategy_id in _memory:
        return _memory[strategy_id]
    path = snapshot_path(strategy_id)
    from json_io import read_json_file

    data = read_json_file(path)
    if isinstance(data, dict):
        _memory[strategy_id] = data
        return data
    return None


def enrich_payload(payload: dict[str, Any] | None, strategy_id: str) -> dict[str, Any]:
    entry = STRATEGY_REGISTRY[strategy_id]
    if not payload:
        now_utc = datetime.now(timezone.utc)
        now_ny = now_utc.astimezone(NY)
        return {
            "version": 1,
            "strategyId": strategy_id,
            "strategy": entry["meta"],
            "markets": _empty_markets(),
            "activeByRegion": {"kr": {"signals": []}, "us": {"signals": []}, "combined": [], "count": 0},
            "activeSignals": [],
            "activeCount": 0,
            "updatedAtNy": now_ny.isoformat(),
            "displayTimezone": "America/New_York",
            "updateSchedule": GLOBAL_UPDATE_SCHEDULE,
            "empty": True,
        }
    if not payload.get("strategy"):
        payload = dict(payload)
        payload["strategy"] = entry["meta"]
    return payload
