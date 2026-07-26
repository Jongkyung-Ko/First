"""재무 종합 점수 cron batch — 시장당 8종목 청크 (Render 30s gateway safe)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from stock_quality_score import UNIVERSE_LIMIT, rank_rows, scan_market_chunk
from stock_quality_score_snapshot import load_snapshot, merge_region, save_snapshot_disk
from stock_strategy_universes import ALL_MARKET_KEYS, KST, NY, market_configs, region_market_keys

QUALITY_CHUNK_SIZE = 8
CRON_BATCH_API_VERSION = 1


def _markets_for_region(region: str) -> tuple[str, ...]:
    if region in ALL_MARKET_KEYS:
        return (region,)
    return region_market_keys(region)


def _merge_partial_rows(
    prev_block: dict[str, Any] | None,
    chunk_rows: list[dict[str, Any]],
    chunk_tickers: set[str],
) -> list[dict[str, Any]]:
    kept = [r for r in (prev_block or {}).get("_partialRows") or [] if r.get("ticker") not in chunk_tickers]
    kept.extend(chunk_rows)
    return kept


def _finalize_market_block(
    config: dict[str, Any],
    rows: list[dict[str, Any]],
    errors: list[str],
) -> dict[str, Any]:
    market_id = config["id"]
    tz = config["timezone"]
    now_local = datetime.now(tz)
    items = rank_rows(rows)

    return {
        "market": market_id,
        "segmentTitle": config["title"],
        "universeSize": len(config["universe"]),
        "scannedCount": len(rows),
        "errorCount": len(errors),
        "errors": errors[:20],
        "items": items,
        "qualityReady": True,
        "analysisDate": now_local.date().isoformat(),
        "updateSchedule": config.get("updateSchedule"),
    }


def build_and_save_batch_market(
    market_key: str,
    *,
    offset: int = 0,
    limit: int = QUALITY_CHUNK_SIZE,
    finalize: bool = False,
    max_offset: int | None = None,
) -> dict[str, Any]:
    configs = market_configs(universe_limit=UNIVERSE_LIMIT)
    if market_key not in configs:
        raise ValueError(f"Unknown market: {market_key}")

    config = configs[market_key]
    universe_size = len(config["universe"])
    cap = min(universe_size, max_offset) if max_offset is not None else universe_size

    if finalize:
        existing = load_snapshot(use_memory=False) or {}
        prev = (existing.get("markets") or {}).get(market_key) or {}
        partial = list(prev.get("_partialRows") or [])
        errors = list(prev.get("errors") or [])
        block = _finalize_market_block(config, partial, errors)
        now_utc_dt = datetime.now(timezone.utc)
        now_utc = now_utc_dt.isoformat()
        fresh = {
            "markets": {market_key: block},
            "updatedAt": now_utc,
            "updatedAtKst": now_utc_dt.astimezone(KST).isoformat(),
            "updatedAtNy": now_utc_dt.astimezone(NY).isoformat(),
            "regions": {
                market_key: {
                    "updatedAt": now_utc,
                    "updatedAtKst": now_utc_dt.astimezone(KST).isoformat(),
                    "updatedAtNy": now_utc_dt.astimezone(NY).isoformat(),
                    "updateSchedule": config.get("updateSchedule"),
                }
            },
        }
        payload = merge_region(existing, fresh, market_key)
        payload["source"] = "cron"
        payload["scanRegion"] = market_key
        save_snapshot_disk(payload, sync_global=True)
        return {
            "ok": True,
            "apiVersion": CRON_BATCH_API_VERSION,
            "market": market_key,
            "finalize": True,
            "qualityReady": block.get("qualityReady"),
            "scannedCount": block.get("scannedCount"),
        }

    effective_limit = min(limit, max(0, cap - offset))
    if effective_limit <= 0:
        return {
            "ok": True,
            "apiVersion": CRON_BATCH_API_VERSION,
            "market": market_key,
            "offset": offset,
            "limit": limit,
            "done": False,
            "phaseComplete": True,
            "nextOffset": offset,
            "maxOffset": max_offset,
        }

    chunk_rows, chunk_errors = scan_market_chunk(market_key, offset, effective_limit)
    chunk_tickers = {r.get("ticker") for r in chunk_rows if r.get("ticker")}

    if not chunk_tickers and effective_limit > 0:
        return {
            "ok": True,
            "market": market_key,
            "offset": offset,
            "limit": limit,
            "done": True,
            "nextOffset": offset,
        }

    existing = load_snapshot(use_memory=False) or {}
    prev_block = (existing.get("markets") or {}).get(market_key) or {}
    partial = _merge_partial_rows(prev_block, chunk_rows, chunk_tickers)
    all_errors = list(prev_block.get("errors") or [])
    all_errors.extend(chunk_errors)

    next_offset = offset + effective_limit
    universe_done = next_offset >= universe_size
    phase_done = max_offset is not None and next_offset >= max_offset
    done = universe_done

    if done:
        block = _finalize_market_block(config, partial, all_errors)
    else:
        block = {
            "market": market_key,
            "segmentTitle": config["title"],
            "universeSize": universe_size,
            "scannedCount": len(partial),
            "errorCount": len(all_errors),
            "errors": all_errors[:20],
            "_partialRows": partial,
            "qualityReady": False,
            "analysisDate": datetime.now(config["timezone"]).date().isoformat(),
        }

    now_utc_dt = datetime.now(timezone.utc)
    now_kst = now_utc_dt.astimezone(KST)
    now_utc = now_utc_dt.isoformat()
    fresh = {
        "markets": {market_key: block},
        "updatedAt": now_utc,
        "updatedAtKst": now_kst.isoformat(),
        "updatedAtNy": now_utc_dt.astimezone(NY).isoformat(),
        "regions": {
            market_key: {
                "updatedAt": now_utc,
                "updatedAtKst": now_kst.isoformat(),
                "updatedAtNy": now_utc_dt.astimezone(NY).isoformat(),
                "updateSchedule": config.get("updateSchedule"),
            }
        },
    }
    payload = merge_region(existing, fresh, market_key)
    payload["source"] = "cron"
    payload["scanRegion"] = market_key
    payload["chunk"] = {
        "offset": offset,
        "limit": effective_limit,
        "tickers": len(chunk_tickers),
        "nextOffset": next_offset if not done else universe_size,
        "done": done,
        "phaseComplete": phase_done and not done,
        "maxOffset": max_offset,
    }
    save_snapshot_disk(payload, sync_global=done)

    return {
        "ok": True,
        "apiVersion": CRON_BATCH_API_VERSION,
        "market": market_key,
        "offset": offset,
        "limit": effective_limit,
        "done": done,
        "phaseComplete": phase_done and not done,
        "nextOffset": next_offset if not done else universe_size,
        "maxOffset": max_offset,
        "qualityReady": block.get("qualityReady"),
        "scannedCount": block.get("scannedCount"),
        "chunk": payload["chunk"],
    }


def reset_market_partial(market_key: str) -> None:
    """Phase 1 시작 전 해당 시장 partial 초기화."""
    existing = load_snapshot(use_memory=False) or {}
    markets = dict(existing.get("markets") or {})
    markets[market_key] = {
        "market": market_key,
        "universeSize": UNIVERSE_LIMIT,
        "scannedCount": 0,
        "qualityReady": False,
        "_partialRows": [],
        "errors": [],
    }
    existing["markets"] = markets
    save_snapshot_disk(existing, sync_global=False)
