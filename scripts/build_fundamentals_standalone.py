#!/usr/bin/env python3
"""Build fundamentals snapshot JSON (PER·ROE·PBR·배당) for GitHub Pages + Render upload."""

from __future__ import annotations

import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
sys.path.insert(0, BACKEND)

from stock_fundamentals_snapshot import (  # noqa: E402
    build_and_save_all,
    build_and_save_region,
    snapshot_path,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build stock-fundamentals snapshot JSON")
    parser.add_argument(
        "--region",
        choices=("kr", "us", "all"),
        default="all",
        help="kr=KOSPI·KOSDAQ, us=NASDAQ·NYSE, all=전체",
    )
    args = parser.parse_args()

    print(f"Scanning fundamentals region={args.region} -> {snapshot_path().name}")
    if args.region == "all":
        payload = build_and_save_all()
    else:
        payload = build_and_save_region(args.region)

    payload["source"] = "cron"
    from stock_fundamentals_snapshot import save_snapshot_disk

    save_snapshot_disk(payload)
    markets = payload.get("markets") or {}
    ready = [k for k, block in markets.items() if isinstance(block, dict) and block.get("fundamentalsReady")]
    print(
        f"Wrote {snapshot_path()} — ready={','.join(ready) or 'none'} · "
        f"updatedAt={payload.get('updatedAt')}"
    )


if __name__ == "__main__":
    main()
