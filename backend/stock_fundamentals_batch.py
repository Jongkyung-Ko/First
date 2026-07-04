"""Fundamentals cron batch — market chunk scan (Render 30s gateway safe)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fundamentals_universes import ALL_MARKET_KEYS, NY, market_configs, region_market_keys
from stock_fundamentals import (
    _fetch_row,
    _rank_metric,
    scan_market_fundamentals,
)
from stock_fundamentals_snapshot import load_snapshot, merge_region, save_snapshot_disk

FUNDAMENTALS_CHUNK_SIZE = 8
CRON_BATCH_API_VERSION = 2


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
    from fundamentals_universes import FUNDAMENTALS_TOP_N
    from stock_fundamentals import METRIC_DEFS

    market_id = config["id"]
    tz = config["timezone"]
    now_local = datetime.now(tz)

    rankings: dict[str, Any] = {}
    for metric_key, spec in METRIC_DEFS.items():
        items = _rank_metric(rows, metric_key)
        rankings[metric_key] = {
            "metric": metric_key,
            "label": spec["label"],
            "sortAsc": spec["asc"],
            "topN": FUNDAMENTALS_TOP_N,
            "count": len(items),
            "items": items,
        }

    return {
        "market": market_id,
        "segmentTitle": config["title"],
        "universeSize": len(config["universe"]),
        "scannedCount": len(rows),
        "errorCount": len(errors),
        "errors": errors[:20],
        "rankings": rankings,
        "fundamentalsReady": True,
        "recentCount": sum(len(r["items"]) for r in rankings.values()),
        "analysisDate": now_local.date().isoformat(),
    }


def _scan_chunk_rows(
    config: dict[str, Any],
    offset: int,
    limit: int,
    *,
    use_dart: bool = False,
) -> tuple[list[dict[str, Any]], list[str], set[str]]:
    from concurrent.futures import ThreadPoolExecutor, as_completed

    from fundamentals_universes import MARKET_EXCHANGE_LABELS

    market_id = config["id"]
    currency = config.get("currency", "USD")
    universe = config["universe"]
    chunk = universe[offset : offset + limit]
    if not chunk:
        return [], [], set()

    rows: list[dict[str, Any]] = []
    errors: list[str] = []
    tickers: set[str] = set()

    def fetch_one(ticker_name: tuple[str, str]) -> dict[str, Any]:
        ticker, name = ticker_name
        row = _fetch_row(ticker, name, currency, use_dart=use_dart)
        row["segment"] = market_id
        row["exchange"] = MARKET_EXCHANGE_LABELS.get(market_id, market_id.upper())
        return row

    workers = min(4, max(1, len(chunk)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch_one, item): item[0] for item in chunk}
        for future in as_completed(futures):
            ticker = futures[future]
            tickers.add(ticker)
            try:
                rows.append(future.result())
            except Exception as exc:
                errors.append(f"{ticker}: {exc}")

    return rows, errors, tickers


def build_and_save_batch_market(
    market_key: str,
    *,
    offset: int = 0,
    limit: int = FUNDAMENTALS_CHUNK_SIZE,
    finalize: bool = False,
    fast: bool = True,
) -> dict[str, Any]:
    configs = market_configs()
    if market_key not in configs:
        raise ValueError(f"Unknown market: {market_key}")

    config = configs[market_key]
    universe_size = len(config["universe"])

    if finalize:
        existing = load_snapshot(use_memory=False) or {}
        prev = (existing.get("markets") or {}).get(market_key) or {}
        partial = list(prev.get("_partialRows") or [])
        errors = list(prev.get("errors") or [])
        if not partial:
            block = _finalize_market_block(config, [], errors)
        else:
            block = _finalize_market_block(config, partial, errors)
        now_utc = datetime.now(timezone.utc).isoformat()
        fresh = {
            "markets": {market_key: block},
            "updatedAt": now_utc,
            "updatedAtNy": datetime.now(timezone.utc).astimezone(NY).isoformat(),
        }
        payload = merge_region(existing, fresh, market_key)
        payload["source"] = "cron"
        payload["scanRegion"] = market_key
        save_snapshot_disk(payload, sync_global=True)
        _append_history(market_key, block)
        return {
            "ok": True,
            "apiVersion": CRON_BATCH_API_VERSION,
            "fast": fast,
            "market": market_key,
            "finalize": True,
            "fundamentalsReady": block.get("fundamentalsReady"),
            "scannedCount": block.get("scannedCount"),
        }

    use_dart = not fast
    chunk_rows, chunk_errors, chunk_tickers = _scan_chunk_rows(
        config, offset, limit, use_dart=use_dart
    )
    if not chunk_tickers:
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

    next_offset = offset + limit
    done = next_offset >= universe_size

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
            "fundamentalsReady": False,
            "analysisDate": datetime.now(config["timezone"]).date().isoformat(),
        }

    now_utc = datetime.now(timezone.utc).isoformat()
    fresh = {
        "markets": {market_key: block},
        "updatedAt": now_utc,
        "updatedAtNy": datetime.now(timezone.utc).astimezone(NY).isoformat(),
    }
    payload = merge_region(existing, fresh, market_key)
    payload["source"] = "cron"
    payload["scanRegion"] = market_key
    payload["chunk"] = {
        "offset": offset,
        "limit": limit,
        "tickers": len(chunk_tickers),
        "nextOffset": next_offset if not done else universe_size,
        "done": done,
    }
    save_snapshot_disk(payload, sync_global=done)

    if done:
        _append_history(market_key, block)

    return {
        "ok": True,
        "apiVersion": CRON_BATCH_API_VERSION,
        "fast": fast,
        "market": market_key,
        "offset": offset,
        "limit": limit,
        "done": done,
        "nextOffset": next_offset if not done else universe_size,
        "fundamentalsReady": block.get("fundamentalsReady"),
        "scannedCount": block.get("scannedCount"),
    }


def _append_history(market_id: str, block: dict[str, Any]) -> None:
    try:
        from recommendation_history import append_fundamentals_market_history

        append_fundamentals_market_history(market_id, block)
    except Exception:
        pass


def build_region_in_chunks(
    region: str,
    *,
    chunk_size: int = FUNDAMENTALS_CHUNK_SIZE,
) -> dict[str, Any]:
    """Run all chunks for a region in-process (local scripts only)."""
    results: list[dict[str, Any]] = []
    for market_key in _markets_for_region(region):
        offset = 0
        while True:
            result = build_and_save_batch_market(
                market_key,
                offset=offset,
                limit=chunk_size,
            )
            results.append(result)
            if result.get("done"):
                break
            offset = int(result.get("nextOffset") or offset + chunk_size)
    return {"ok": True, "region": region, "chunks": len(results), "markets": _markets_for_region(region)}
