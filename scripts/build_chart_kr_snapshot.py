#!/usr/bin/env python3
"""Build data/chart-kr-snapshot.json for GitHub Pages (Chart KR, KST 18:00)."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
sys.path.insert(0, BACKEND)

os.environ.setdefault("HEADLINES_CACHE_TTL", "600")

from chart_snapshot import build_and_save_kr_snapshot  # noqa: E402
from main import CHART_MARKET_UNIVERSES, _fetch_price_change, collect_chart_data  # noqa: E402

OUTPUT = os.path.join(ROOT, "data", "chart-kr-snapshot.json")


def fetch_chart(ticker: str, period: str, interval: str = "1d", **kwargs):
    return collect_chart_data(
        ticker,
        period,
        interval,
        after_scheduled_update=kwargs.get("after_scheduled_update", True),
        skip_snapshot=True,
    )


def main() -> None:
    trigger = os.environ.get("GITHUB_EVENT_NAME", "manual")
    print(f"Building KR chart snapshot (trigger={trigger})...")
    payload = build_and_save_kr_snapshot(
        fetch_chart,
        _fetch_price_change,
        CHART_MARKET_UNIVERSES,
        after_scheduled_update=True,
    )
    payload["trigger"] = trigger
    payload["builtAt"] = datetime.now(timezone.utc).isoformat()

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    for market_id, block in (payload.get("markets") or {}).items():
        chart_count = sum(
            1
            for charts in (block.get("charts") or {}).values()
            for period_data in charts.values()
            if period_data and period_data.get("candles")
        )
        print(f"  {market_id}: {block.get('count', 0)} items, {chart_count} chart series")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
