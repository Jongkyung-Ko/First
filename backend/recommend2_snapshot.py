"""바닥매집 스냅샷 — 디스크 저장·병합·조회."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from recommend2_bottom_accumulation import (
    KST,
    KR_MARKET_KEYS,
    MARKET_CONFIGS,
    STRATEGY_META,
    US_MARKET_KEYS,
    collect_bottom_accumulation,
)

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SNAPSHOT_PATH = ROOT / "data" / "recommend2-bottom-accumulation.json"

_memory_snapshot: dict[str, Any] | None = None


def snapshot_path() -> Path:
    raw = os.getenv("RECOMMEND2_SNAPSHOT_PATH", "").strip()
    return Path(raw) if raw else DEFAULT_SNAPSHOT_PATH


def _empty_markets() -> dict[str, Any]:
    return {key: {} for key in MARKET_CONFIGS}


def assemble_payload(
    markets: dict[str, Any],
    *,
    source: str = "snapshot",
    saved_at: str | None = None,
) -> dict[str, Any]:
    """시장별 스캔 결과를 API 응답 형태로 조립."""
    now_utc = datetime.now(timezone.utc)
    now_kst = now_utc.astimezone(KST)
    kospi = markets.get("kospi") or {}

    return {
        "version": 5,
        "source": source,
        "savedAt": saved_at or now_utc.isoformat(),
        "updatedAt": now_utc.isoformat(),
        "updatedAtKst": now_kst.isoformat(),
        "updateSchedule": (
            "KOSPI·KOSDAQ 매일 18:00 (KST) · NASDAQ·NYSE 매일 18:00 (ET) · 장 마감 후 T-2·T-1"
        ),
        "analysisDate": kospi.get("analysisDate"),
        "timezone": "Asia/Seoul",
        "strategy": STRATEGY_META,
        "markets": markets,
        "latestSignalDate": kospi.get("latestSignalDate"),
        "activeSignals": kospi.get("activeSignals", []),
        "activeDisplayDate": kospi.get("activeDisplayDate"),
        "activeIsFallback": kospi.get("activeIsFallback", False),
        "recentSignals": kospi.get("recentSignals", []),
        "activeCount": kospi.get("activeCount", 0),
        "recentCount": kospi.get("recentCount", 0),
        "scanErrors": kospi.get("scanErrors", []),
        "universeSize": kospi.get("universeSize", 100),
    }


def merge_market_results(
    existing: dict[str, Any] | None,
    fresh: dict[str, Any],
    market_keys: tuple[str, ...],
) -> dict[str, Any]:
    """기존 스냅샷에 일부 시장 스캔 결과만 병합."""
    markets = dict((existing or {}).get("markets") or _empty_markets())
    fresh_markets = fresh.get("markets") or {}
    for key in market_keys:
        if key in fresh_markets:
            markets[key] = fresh_markets[key]

    saved_at = fresh.get("updatedAt") or datetime.now(timezone.utc).isoformat()
    payload = assemble_payload(markets, source="snapshot", saved_at=saved_at)
    regions = (existing or {}).get("regions") or {}
    if isinstance(regions, dict):
        payload["regions"] = dict(regions)
    else:
        payload["regions"] = {}

    for key in market_keys:
        region = "kr" if key in KR_MARKET_KEYS else "us"
        payload["regions"][region] = {
            "updatedAt": saved_at,
            "marketKeys": list(
                k for k in (KR_MARKET_KEYS if region == "kr" else US_MARKET_KEYS) if k in markets
            ),
        }
    return payload


def load_snapshot() -> dict[str, Any] | None:
    global _memory_snapshot
    if _memory_snapshot is not None:
        return _memory_snapshot

    path = snapshot_path()
    if not path.is_file():
        return None
    try:
        with path.open(encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict) and data.get("markets"):
            _memory_snapshot = data
            return data
    except (OSError, json.JSONDecodeError):
        return None
    return None


def save_snapshot(payload: dict[str, Any]) -> Path:
    global _memory_snapshot
    path = snapshot_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(payload)
    payload["source"] = "snapshot"
    payload["savedAt"] = payload.get("savedAt") or datetime.now(timezone.utc).isoformat()

    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    _memory_snapshot = payload
    return path


def region_market_keys(region: str) -> tuple[str, ...]:
    r = region.strip().lower()
    if r == "kr":
        return KR_MARKET_KEYS
    if r == "us":
        return US_MARKET_KEYS
    if r in ("all", ""):
        return tuple(MARKET_CONFIGS.keys())
    raise ValueError(f"Unknown region: {region}")


def build_and_save_snapshot(
    fetch_chart,
    *,
    region: str = "all",
    period: str = "3mo",
    after_scheduled_update: bool | None = None,
) -> dict[str, Any]:
    """스캔 후 디스크 스냅샷 저장 (region=kr|us|all)."""
    keys = region_market_keys(region)
    existing = load_snapshot()

    if after_scheduled_update is None and region in ("kr", "us"):
        after_scheduled_update = True

    fresh = collect_bottom_accumulation(
        fetch_chart,
        period=period,
        market_keys=keys,
        after_scheduled_update=after_scheduled_update,
    )
    payload = merge_market_results(existing, fresh, keys)
    save_snapshot(payload)
    return payload
