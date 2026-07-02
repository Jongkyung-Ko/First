"""Stock Picks 통합 배치 — 시장별 TOP 100 캔들 1회 수집 후 전략 일괄 스캔."""

from __future__ import annotations

from typing import Any, Callable

from recommend2_bottom_accumulation import (
    MARKET_CONFIGS as R2_MARKET_CONFIGS,
    scan_market_universe as r2_scan_market_universe,
)
from stock_picks_universe import STOCK_PICKS_FETCH_PERIOD, STOCK_PICKS_UNIVERSE_LIMIT
from stock_strategy_engine import scan_market_universe
from stock_strategy_universes import market_configs

BATCH_CHUNK_SIZE = 25


def make_cached_chart_fetcher(
    raw_fetch: Callable[..., dict[str, Any]],
    *,
    period: str = STOCK_PICKS_FETCH_PERIOD,
) -> Callable[..., dict[str, Any]]:
    """종목·after_scheduled_update 조합당 캔들 1회만 수집."""
    cache: dict[tuple[str, str | None], dict[str, Any]] = {}

    def fetch_chart(
        ticker: str,
        period_arg: str = period,
        tz=None,
        after_scheduled_update: bool | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        del period_arg
        after_key: str | None
        if after_scheduled_update is True:
            after_key = "1"
        elif after_scheduled_update is False:
            after_key = "0"
        else:
            after_key = None
        key = (ticker, after_key)
        if key not in cache:
            cache[key] = raw_fetch(
                ticker,
                period,
                tz=tz,
                after_scheduled_update=after_scheduled_update,
                **kwargs,
            )
        return cache[key]

    return fetch_chart


def _save_strategy_snapshot(strategy_id: str, payload: dict[str, Any]) -> None:
    from stock_strategy_snapshot import save_strategy_snapshot_disk

    save_strategy_snapshot_disk(strategy_id, payload)


def _slice_universe(
    universe: list[tuple[str, str]],
    offset: int,
    limit: int,
) -> tuple[list[tuple[str, str]], set[str]]:
    chunk = universe[offset : offset + limit]
    tickers = {t for t, _ in chunk}
    return chunk, tickers


def _merge_signal_lists(
    existing: list[dict[str, Any]] | None,
    chunk: list[dict[str, Any]] | None,
    chunk_tickers: set[str],
) -> list[dict[str, Any]]:
    kept = [s for s in (existing or []) if s.get("ticker") not in chunk_tickers]
    kept.extend(chunk or [])
    kept.sort(key=lambda s: (s.get("signalDate") or s.get("day1") or "", s.get("ticker") or ""))
    return kept


def _merge_market_block(
    existing_block: dict[str, Any] | None,
    chunk_block: dict[str, Any],
    chunk_tickers: set[str],
) -> dict[str, Any]:
    base = dict(existing_block or {})
    merged = dict(chunk_block)
    for field in ("recentSignals", "activeSignals", "allSignals"):
        if field in chunk_block or field in base:
            merged[field] = _merge_signal_lists(
                base.get(field),
                chunk_block.get(field),
                chunk_tickers,
            )
    merged["recentCount"] = len(merged.get("recentSignals") or [])
    merged["activeCount"] = len(merged.get("activeSignals") or [])
    errors = list(base.get("scanErrors") or []) + list(chunk_block.get("scanErrors") or [])
    merged["scanErrors"] = errors[:8]
    return merged


def _scan_r2_market_slice(
    fetch: Callable[..., dict[str, Any]],
    market_key: str,
    offset: int,
    limit: int,
    *,
    after_scheduled_update: bool | None,
) -> tuple[dict[str, Any], set[str]]:
    cfg = dict(R2_MARKET_CONFIGS[market_key])
    chunk, tickers = _slice_universe(cfg["universe"], offset, limit)
    if not chunk:
        return {}, tickers
    cfg["universe"] = chunk
    block = r2_scan_market_universe(
        fetch,
        cfg,
        period=STOCK_PICKS_FETCH_PERIOD,
        after_scheduled_update=after_scheduled_update,
    )
    return block, tickers


def _scan_strategy_market_slice(
    fetch: Callable[..., dict[str, Any]],
    market_key: str,
    detect_fn: Callable,
    offset: int,
    limit: int,
    *,
    after_scheduled_update: bool | None,
) -> tuple[dict[str, Any], set[str]]:
    cfg = dict(market_configs()[market_key])
    chunk, tickers = _slice_universe(cfg["universe"], offset, limit)
    if not chunk:
        return {}, tickers
    cfg["universe"] = chunk
    block = scan_market_universe(
        fetch,
        cfg,
        detect_fn,
        period=STOCK_PICKS_FETCH_PERIOD,
        after_scheduled_update=after_scheduled_update,
    )
    return block, tickers


def _recompute_r2_active(market_block: dict[str, Any]) -> dict[str, Any]:
    """청크 병합 후 활성 신호 재계산."""
    block = dict(market_block)
    recent = block.get("recentSignals") or []
    recent_days = int(block.get("recentDays") or 14)
    analysis = block.get("analysisDate")
    if not analysis and recent:
        analysis = max(str(s.get("signalDate") or "") for s in recent)
    block["analysisDate"] = analysis

    active = [s for s in recent if analysis and s.get("day1") == analysis]
    active_is_fallback = False
    display = analysis
    if not active and analysis:
        on_or_before = [
            s for s in recent if s.get("signalDate") and str(s["signalDate"]) <= str(analysis)
        ]
        if on_or_before:
            batch_date = max(str(s["signalDate"]) for s in on_or_before)
            active = [s for s in on_or_before if str(s.get("signalDate")) == batch_date]
            active_is_fallback = True
            display = batch_date

    block["activeSignals"] = active
    block["activeCount"] = len(active)
    block["activeDisplayDate"] = display
    block["activeIsFallback"] = active_is_fallback
    block["latestSignalDate"] = display or analysis
    return block


def _recompute_strategy_active(market_block: dict[str, Any]) -> dict[str, Any]:
    from stock_strategy_record import compute_match_stats

    block = dict(market_block)
    recent = block.get("recentSignals") or []
    analysis = block.get("analysisDate")
    if not analysis and recent:
        analysis = max(str(s.get("signalDate") or "") for s in recent)
    block["analysisDate"] = analysis
    active = [s for s in recent if analysis and s.get("signalDate") == analysis]
    if not active and analysis:
        on_or_before = [
            s for s in recent if s.get("signalDate") and str(s["signalDate"]) <= str(analysis)
        ]
        if on_or_before:
            batch_date = max(str(s["signalDate"]) for s in on_or_before)
            active = [s for s in on_or_before if str(s.get("signalDate")) == batch_date]
            block["activeIsFallback"] = True
            block["activeDisplayDate"] = batch_date
    block["activeSignals"] = active
    block["activeCount"] = len(active)
    block["recentCount"] = len(recent)
    block["matchStats"] = compute_match_stats(recent)
    return block


def build_and_save_batch_market(
    market_key: str,
    raw_fetch: Callable[..., dict[str, Any]],
    *,
    after_scheduled_update: bool | None = None,
    source: str = "live",
    offset: int = 0,
    limit: int = BATCH_CHUNK_SIZE,
    finalize: bool = False,
) -> dict[str, Any]:
    """시장 청크 스캔 또는 병합 후 활성 신호 재계산."""
    from recommend2_snapshot import (
        enrich_payload as enrich_r2,
        load_snapshot as load_r2,
        merge_market_results as merge_r2,
        save_snapshot as save_r2,
    )
    from stock_strategy_snapshot import (
        STRATEGY_REGISTRY,
        enrich_payload,
        load_snapshot,
        merge_market_results,
    )

    keys = (market_key,)

    if finalize:
        r2_payload = load_r2() or {}
        markets = dict(r2_payload.get("markets") or {})
        if market_key in markets:
            markets[market_key] = _recompute_r2_active(markets[market_key])
        r2_payload["markets"] = markets
        r2_payload = merge_r2(r2_payload, {"markets": markets}, keys)
        r2_payload["source"] = source
        r2_payload["scanRegion"] = market_key
        save_r2(r2_payload)
        r2_payload = enrich_r2(dict(r2_payload))

        strategies_out: dict[str, Any] = {}
        for sid, entry in STRATEGY_REGISTRY.items():
            existing = load_snapshot(sid, use_memory=False) or {}
            sm = dict(existing.get("markets") or {})
            if market_key in sm:
                sm[market_key] = _recompute_strategy_active(sm[market_key])
            payload = merge_market_results(
                existing,
                {"markets": {market_key: sm[market_key]}},
                keys,
                active_label=entry["active_label"],
            )
            payload["source"] = source
            payload["scanRegion"] = market_key
            _save_strategy_snapshot(sid, payload)
            strategies_out[sid] = enrich_payload(dict(payload), sid)

        return {
            "ok": True,
            "scanRegion": market_key,
            "finalize": True,
            "recommend2": r2_payload,
            "strategies": strategies_out,
        }

    fetch = make_cached_chart_fetcher(raw_fetch)
    existing_r2 = load_r2()

    r2_chunk, r2_tickers = _scan_r2_market_slice(
        fetch,
        market_key,
        offset,
        limit,
        after_scheduled_update=after_scheduled_update,
    )
    if not r2_tickers:
        return {
            "ok": True,
            "scanRegion": market_key,
            "offset": offset,
            "limit": limit,
            "done": True,
            "recommend2": enrich_r2(dict(existing_r2 or {})),
            "strategies": {},
        }

    r2_markets = dict((existing_r2 or {}).get("markets") or {})
    prev_r2 = r2_markets.get(market_key) or {}
    r2_markets[market_key] = _merge_market_block(prev_r2, r2_chunk, r2_tickers)
    fresh_r2 = {
        "markets": {market_key: r2_markets[market_key]},
        "updatedAt": r2_chunk.get("updatedAt"),
    }
    r2_payload = merge_r2(existing_r2, fresh_r2, keys)
    r2_payload["source"] = source
    r2_payload["scanRegion"] = market_key
    r2_payload["chunk"] = {"offset": offset, "limit": limit, "tickers": len(r2_tickers)}
    save_r2(r2_payload)
    r2_payload = enrich_r2(dict(r2_payload))

    strategies_out: dict[str, Any] = {}
    for sid, entry in STRATEGY_REGISTRY.items():
        existing = load_snapshot(sid, use_memory=False)
        chunk_block, _ = _scan_strategy_market_slice(
            fetch,
            market_key,
            entry["detect"],
            offset,
            limit,
            after_scheduled_update=after_scheduled_update,
        )
        sm = dict((existing or {}).get("markets") or {})
        prev = sm.get(market_key) or {}
        sm[market_key] = _merge_market_block(prev, chunk_block, r2_tickers)
        payload = merge_market_results(
            existing,
            {"markets": {market_key: sm[market_key]}},
            keys,
            active_label=entry["active_label"],
        )
        payload["source"] = source
        payload["scanRegion"] = market_key
        payload["chunk"] = {"offset": offset, "limit": limit}
        _save_strategy_snapshot(sid, payload)
        strategies_out[sid] = enrich_payload(dict(payload), sid)

    universe_len = len(R2_MARKET_CONFIGS[market_key]["universe"])
    next_offset = offset + limit
    return {
        "ok": True,
        "scanRegion": market_key,
        "offset": offset,
        "limit": limit,
        "nextOffset": next_offset if next_offset < universe_len else None,
        "recommend2": r2_payload,
        "strategies": strategies_out,
    }


def build_and_save_batch_region(
    raw_fetch: Callable[..., dict[str, Any]],
    *,
    region: str,
    after_scheduled_update: bool | None = None,
    source: str = "live",
) -> dict[str, Any]:
    """region=kr|us|all|단일 시장 — 시장 순차 스캔 (서버 cron용, 비권장·타임아웃)."""
    from stock_strategy_universes import region_market_keys

    keys = region_market_keys(region)
    last: dict[str, Any] | None = None
    for market_key in keys:
        offset = 0
        while offset < STOCK_PICKS_UNIVERSE_LIMIT:
            last = build_and_save_batch_market(
                market_key,
                raw_fetch,
                after_scheduled_update=after_scheduled_update,
                source=source,
                offset=offset,
                limit=BATCH_CHUNK_SIZE,
            )
            nxt = last.get("nextOffset")
            if nxt is None:
                break
            offset = int(nxt)
        if last:
            last = build_and_save_batch_market(
                market_key,
                raw_fetch,
                after_scheduled_update=after_scheduled_update,
                source=source,
                finalize=True,
            )
    if last is None:
        raise ValueError(f"No markets for region: {region}")
    if len(keys) == 1:
        return last
    return {
        "ok": True,
        "region": region,
        "markets": list(keys),
        "recommend2": last["recommend2"],
        "strategies": last["strategies"],
        "scanRegion": keys[-1],
    }
