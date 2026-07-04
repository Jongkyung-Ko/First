#!/usr/bin/env python3
"""Backfill holdDay2~5ReturnPct on existing strategy + recommend2 snapshots."""

from __future__ import annotations

import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
sys.path.insert(0, BACKEND)

from hold_return_backfill import (  # noqa: E402
    backfill_recommend2_snapshot,
    backfill_strategy_snapshots,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill 2~5 day hold returns on snapshot signals")
    parser.add_argument(
        "--days",
        type=int,
        default=14,
        help="Only signals within this many calendar days (default 14, matches recentSignals window)",
    )
    parser.add_argument("--skip-strategies", action="store_true")
    parser.add_argument("--skip-recommend2", action="store_true")
    parser.add_argument("--no-supabase", action="store_true", help="Disk JSON only")
    args = parser.parse_args()

    save_sb = not args.no_supabase
    summary: dict = {"days": args.days}

    if not args.skip_strategies:
        print(f"Backfilling stock strategies (last {args.days}d signals)...")
        summary["strategies"] = backfill_strategy_snapshots(
            lookback_days=args.days,
            save_disk=True,
            save_supabase=save_sb,
        )
        for row in summary["strategies"]:
            print(
                f"  {row.get('strategyId')}: touched={row.get('touchedSignals', 0)} "
                f"enriched={row.get('enrichedSignals', 0)} skipped={row.get('skipped')}"
            )

    if not args.skip_recommend2:
        print(f"Backfilling recommend2 (last {args.days}d signals)...")
        summary["recommend2"] = backfill_recommend2_snapshot(
            lookback_days=args.days,
            save_disk=True,
            save_supabase=save_sb,
        )
        r2 = summary["recommend2"]
        print(
            f"  recommend2: touched={r2.get('touchedSignals', 0)} "
            f"enriched={r2.get('enrichedSignals', 0)} skipped={r2.get('skipped')}"
        )

    out_path = os.path.join(ROOT, "data", "hold-return-backfill-summary.json")
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"Done. Summary -> {out_path}")


if __name__ == "__main__":
    main()
