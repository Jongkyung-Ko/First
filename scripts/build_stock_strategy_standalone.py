#!/usr/bin/env python3
"""Build stock strategy snapshots (golden / bollinger / rsi) for GitHub Pages."""

from __future__ import annotations

import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
sys.path.insert(0, BACKEND)

from stock_strategy_engine import make_yfinance_fetcher  # noqa: E402
from stock_strategy_snapshot import (  # noqa: E402
    STRATEGY_REGISTRY,
    build_and_save_snapshot,
    merge_market_results,
    snapshot_path,
)


def _load_existing(path: str) -> dict | None:
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    return data if isinstance(data, dict) else None


def main() -> None:
    parser = argparse.ArgumentParser(description="Build stock strategy snapshot JSON")
    parser.add_argument(
        "--region",
        choices=("kr", "us", "all"),
        default="all",
        help="kr=KOSPI·KOSDAQ, us=NASDAQ·NYSE, all=전체",
    )
    parser.add_argument(
        "--strategy",
        choices=tuple(STRATEGY_REGISTRY.keys()) + ("all",),
        default="all",
    )
    args = parser.parse_args()

    fetch = make_yfinance_fetcher()
    strategies = list(STRATEGY_REGISTRY.keys()) if args.strategy == "all" else [args.strategy]

    for sid in strategies:
        entry = STRATEGY_REGISTRY[sid]
        path = snapshot_path(sid)
        print(f"Scanning strategy={sid} region={args.region} -> {path.name}")
        existing = _load_existing(str(path))
        from stock_strategy_universes import region_market_keys

        keys = region_market_keys(args.region)
        from stock_strategy_engine import collect_strategy_scan

        fresh = collect_strategy_scan(
            sid,
            entry["detect"],
            fetch,
            period="6mo",
            market_keys=keys,
            after_scheduled_update=True,
            strategy_meta=entry["meta"],
            active_label=entry["active_label"],
            universe_limit=entry.get("universe_limit"),
        )
        payload = merge_market_results(
            existing,
            fresh,
            keys,
            active_label=entry["active_label"],
        )
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        markets = payload.get("markets") or {}
        active = payload.get("activeCount", 0)
        print(f"  active={active} kospi_recent={len(markets.get('kospi', {}).get('recentSignals', []))}")


if __name__ == "__main__":
    main()
