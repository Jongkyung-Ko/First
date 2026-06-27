"""One-time backfill of recent daily closes into stock_pick_predictions."""

from __future__ import annotations

import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from main import collect_recommendations  # noqa: E402
from predictions import backfill_closes_for_group  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill recent closes for Stock Picks.")
    parser.add_argument("--market", choices=["all", "kr", "us"], default="all")
    parser.add_argument("--days", type=int, default=30)
    args = parser.parse_args()

    result = backfill_closes_for_group(args.market, collect_recommendations, args.days)
    print(result)


if __name__ == "__main__":
    main()
