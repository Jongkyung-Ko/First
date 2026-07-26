"""Fundamentals snapshot — single JSON for PER/ROE/PBR/배당 4 tabs."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fundamentals_universes import GLOBAL_UPDATE_SCHEDULE, KST, NY
from stock_fundamentals import (
    FUNDAMENTALS_META,
    SNAPSHOT_FILENAME,
    STRATEGY_ID,
    collect_fundamentals_scan,
    scan_region,
)

ROOT = Path(__file__).resolve().parent.parent
_memory: dict[str, Any] | None = None


def snapshot_path() -> Path:
    raw = os.getenv("STOCK_FUNDAMENTALS_PATH", "").strip()
    if raw:
        return Path(raw)
    return ROOT / "data" / SNAPSHOT_FILENAME


def _empty_markets() -> dict[str, Any]:
    from fundamentals_universes import ALL_MARKET_KEYS

    return {key: {} for key in ALL_MARKET_KEYS}


def merge_region(existing: dict[str, Any] | None, fresh: dict[str, Any], region: str) -> dict[str, Any]:
    markets = dict((existing or {}).get("markets") or _empty_markets())
    fresh_markets = fresh.get("markets") or {}
    keys = (region,) if region in fresh_markets else tuple(fresh_markets.keys())
    for key in keys:
        if key in fresh_markets:
            markets[key] = fresh_markets[key]

    regions = dict((existing or {}).get("regions") or {})
    fresh_regions = fresh.get("regions") or {}
    regions.update(fresh_regions)

    now_utc = fresh.get("updatedAt") or datetime.now(timezone.utc).isoformat()
    now_kst = fresh.get("updatedAtKst") or datetime.now(timezone.utc).astimezone(KST).isoformat()
    now_ny = fresh.get("updatedAtNy") or datetime.now(timezone.utc).astimezone(NY).isoformat()

    return {
        "version": 1,
        "strategyId": STRATEGY_ID,
        "source": fresh.get("source") or "snapshot",
        "savedAt": fresh.get("savedAt") or now_utc,
        "updatedAt": now_utc,
        "updatedAtKst": now_kst,
        "updatedAtNy": now_ny,
        "displayTimezone": fresh.get("displayTimezone") or "Asia/Seoul",
        "updateSchedule": GLOBAL_UPDATE_SCHEDULE,
        "universe": FUNDAMENTALS_META["universe"],
        "strategy": FUNDAMENTALS_META,
        "markets": markets,
        "regions": regions,
        "scanRegion": region if region in fresh_markets else fresh.get("scanRegion"),
    }


def save_snapshot_disk(payload: dict[str, Any], *, sync_global: bool = True) -> None:
    global _memory
    _memory = payload
    path = snapshot_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    except OSError:
        pass

    if not sync_global:
        return

    try:
        from stock_snapshot_store import save_global_snapshot

        save_global_snapshot("fundamentals", payload, source=payload.get("source"))
    except Exception:
        pass


def load_snapshot(*, use_memory: bool = True) -> dict[str, Any] | None:
    global _memory
    if use_memory and _memory:
        return _memory
    path = snapshot_path()
    from json_io import read_json_file

    data = read_json_file(path)
    if isinstance(data, dict):
        _memory = data
        return data
    return None


def build_and_save_region(region: str) -> dict[str, Any]:
    fresh = scan_region(region)
    existing = load_snapshot(use_memory=False)
    payload = merge_region(existing, fresh, region)
    payload["source"] = "live"
    payload["scanRegion"] = region
    save_snapshot_disk(payload)
    try:
        from recommendation_history import append_fundamentals_market_history

        for market_id, block in (fresh.get("markets") or {}).items():
            if isinstance(block, dict):
                append_fundamentals_market_history(market_id, block)
    except Exception:
        pass
    return payload


def build_and_save_all() -> dict[str, Any]:
    payload = collect_fundamentals_scan()
    save_snapshot_disk(payload)
    try:
        from recommendation_history import append_fundamentals_market_history

        for market_id, block in (payload.get("markets") or {}).items():
            if isinstance(block, dict):
                append_fundamentals_market_history(market_id, block)
    except Exception:
        pass
    return payload


def payload_has_data(payload: dict[str, Any] | None) -> bool:
    if not payload or payload.get("empty") is True or payload.get("source") == "placeholder":
        return False
    markets = payload.get("markets") or {}
    for block in markets.values():
        if isinstance(block, dict) and block.get("fundamentalsReady"):
            return True
    return False


def enrich_payload(payload: dict[str, Any] | None) -> dict[str, Any]:
    if not payload:
        now_utc = datetime.now(timezone.utc)
        now_ny = now_utc.astimezone(NY)
        return {
            "version": 1,
            "strategyId": STRATEGY_ID,
            "strategy": FUNDAMENTALS_META,
            "markets": _empty_markets(),
            "updatedAtNy": now_ny.isoformat(),
            "displayTimezone": "America/New_York",
            "updateSchedule": GLOBAL_UPDATE_SCHEDULE,
            "empty": True,
        }
    if not payload.get("strategy"):
        payload = dict(payload)
        payload["strategy"] = FUNDAMENTALS_META
    return payload
