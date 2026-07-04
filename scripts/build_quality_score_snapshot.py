"""로컬 재무종합 스냅샷 빌드 — python scripts/build_quality_score_snapshot.py [kr|us|all]"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from stock_quality_score_snapshot import build_and_save_region, load_snapshot, save_snapshot_disk


def main() -> None:
    region = (sys.argv[1] if len(sys.argv) > 1 else "kr").strip().lower()
    if region not in ("kr", "us", "all"):
        print(f"Unknown region: {region}")
        sys.exit(1)
    if region == "all":
        for r in ("kr", "us"):
            print(f"=== scan {r} ===")
            build_and_save_region(r)
    else:
        build_and_save_region(region)
    payload = load_snapshot(use_memory=False)
    if payload:
        save_snapshot_disk(payload)
        print(f"Saved {ROOT / 'data' / 'stock-quality-score.json'}")


if __name__ == "__main__":
    main()
