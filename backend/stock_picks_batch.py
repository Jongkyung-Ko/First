"""Stock Picks 통합 배치 — 시장별 TOP 100 캔들 1회 수집 후 전략 일괄 스캔."""

from __future__ import annotations

from typing import Any, Callable

from recommend2_bottom_accumulation import collect_bottom_accumulation
from stock_picks_universe import STOCK_PICKS_FETCH_PERIOD
from stock_strategy_engine import collect_strategy_scan


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


def build_and_save_batch_market(
    market_key: str,
    raw_fetch: Callable[..., dict[str, Any]],
    *,
    after_scheduled_update: bool | None = None,
    source: str = "live",
) -> dict[str, Any]:
    """단일 시장(kospi 등) TOP 100 캔들 공유 스캔 → 바닥매집 + 전략 7개 스냅샷 병합."""
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
    fetch = make_cached_chart_fetcher(raw_fetch)

    existing_r2 = load_r2()
    fresh_r2 = collect_bottom_accumulation(
        fetch,
        period=STOCK_PICKS_FETCH_PERIOD,
        market_keys=keys,
        after_scheduled_update=after_scheduled_update,
    )
    r2_payload = merge_r2(existing_r2, fresh_r2, keys)
    r2_payload["source"] = source
    r2_payload["scanRegion"] = market_key
    save_r2(r2_payload)
    r2_payload = enrich_r2(dict(r2_payload))

    strategies_out: dict[str, Any] = {}
    for sid, entry in STRATEGY_REGISTRY.items():
        existing = load_snapshot(sid, use_memory=False)
        fresh = collect_strategy_scan(
            sid,
            entry["detect"],
            fetch,
            period=STOCK_PICKS_FETCH_PERIOD,
            market_keys=keys,
            after_scheduled_update=after_scheduled_update,
            strategy_meta=entry["meta"],
            active_label=entry["active_label"],
        )
        payload = merge_market_results(
            existing,
            fresh,
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
    """region=kr|us|all|단일 시장 — 시장 순차 스캔 (서버 cron용)."""
    from stock_strategy_universes import region_market_keys

    keys = region_market_keys(region)
    last: dict[str, Any] | None = None
    for market_key in keys:
        last = build_and_save_batch_market(
            market_key,
            raw_fetch,
            after_scheduled_update=after_scheduled_update,
            source=source,
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
