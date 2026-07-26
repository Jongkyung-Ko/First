#!/usr/bin/env python3
"""Analyze bollinger KR holdDay2 sum vs UI display."""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data" / "stock-strategy-bollinger.json"


def main() -> None:
    d = json.loads(PATH.read_text(encoding="utf-8"))
    cutoff = (datetime.now().date() - timedelta(days=14)).isoformat()
    print(f"Today cutoff (14d): {cutoff}\n")

    for region, keys in [("kr", ["kospi", "kosdaq"]), ("us", ["nasdaq", "nyse"])]:
        sigs: list[dict] = []
        for k in keys:
            sigs.extend((d.get("markets") or {}).get(k, {}).get("recentSignals") or [])

        all_h2 = [s for s in sigs if s.get("holdDay2ReturnPct") is not None]
        sum_all = sum(float(s["holdDay2ReturnPct"]) for s in all_h2)
        print(f"=== {region.upper()} ALL recentSignals ===")
        print(f"  signals with hold2: {len(all_h2)}")
        print(f"  sum holdDay2: {sum_all:.1f}%")
        print(f"  UI rounded: {round(sum_all, 1):+.1f}%")

        recent14 = [
            s
            for s in all_h2
            if str(s.get("signalDate") or "")[:10] >= cutoff
        ]
        sum14 = sum(float(s["holdDay2ReturnPct"]) for s in recent14)
        print(f"\n  signalDate >= {cutoff}: n={len(recent14)} sum={sum14:.1f}%")

        print("\n  Top 15 holdDay2 contributors:")
        for s in sorted(all_h2, key=lambda x: float(x["holdDay2ReturnPct"]), reverse=True)[:15]:
            sd = str(s.get("signalDate") or "")[:10]
            print(
                f"    {s.get('ticker'):12} {sd}  h2={float(s['holdDay2ReturnPct']):+8.2f}%  "
                f"entry={s.get('entryClose')} entryDate={s.get('entryDate')}"
            )

        # Check for bad entry prices (near zero)
        bad = [s for s in all_h2 if float(s.get("entryClose") or 1) < 100]
        if bad:
            print(f"\n  Low entryClose (<100) count: {len(bad)}")
            for s in sorted(bad, key=lambda x: float(x["holdDay2ReturnPct"]), reverse=True)[:5]:
                ec = float(s.get("entryClose") or 0)
                h2 = float(s["holdDay2ReturnPct"])
                print(f"    {s.get('ticker')} entry={ec} h2={h2:.2f}% implied_exit={ec*(1+h2/100):.2f}")

        print()


if __name__ == "__main__":
    main()
