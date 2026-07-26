#!/usr/bin/env python3
"""Build static stock-news.json for GitHub Pages (scheduled with stock picks)."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
sys.path.insert(0, BACKEND)

os.environ.setdefault("HEADLINES_CACHE_TTL", "600")

from main import collect_headlines  # noqa: E402

MARKETS = ("all", "kr", "us")
LIMIT = 25
SCHEDULE_LABEL = "KST 08:00, 14:00 · US Eastern 08:00, 14:00 (GitHub Actions)"


def build_bundle(trigger: str | None = None) -> dict:
    now = datetime.now(timezone.utc)
    payload: dict = {
        "version": 1,
        "updatedAt": now.isoformat(),
        "updateSchedule": SCHEDULE_LABEL,
        "trigger": trigger or "manual",
        "markets": {},
    }
    for market in MARKETS:
        print(f"Collecting headlines for {market}...")
        payload["markets"][market] = collect_headlines(market, LIMIT, lang="ko")
    return payload


def main() -> None:
    trigger = os.environ.get("GITHUB_EVENT_NAME", "manual")
    payload = build_bundle(trigger=trigger)
    out_dir = os.path.join(ROOT, "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "stock-news.json")
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"Wrote {out_path} ({len(payload['markets'])} markets)")


if __name__ == "__main__":
    main()
