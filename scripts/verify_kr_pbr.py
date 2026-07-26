"""KOSPI PBR — Open DART 전용 경로·스냅샷·Render 진단."""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

RENDER = "https://first-stock-api.onrender.com"
SNAPSHOT = ROOT / "data" / "stock-fundamentals.json"


def http_json(url: str, *, timeout: int = 90) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "DigitalWorld-Verify/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def print_market_pbr(label: str, payload: dict) -> None:
    markets = payload.get("markets") or {}
    print(f"\n=== {label} (source={payload.get('source')}, updated={payload.get('updatedAt')}) ===")
    for key in ("kospi", "kosdaq"):
        block = markets.get(key) or {}
        pbr = ((block.get("rankings") or {}).get("pbr") or {})
        count = pbr.get("count", len(pbr.get("items") or []))
        top = (pbr.get("items") or [{}])[0] if count else {}
        line = f"  {key}: PBR count={count} scanned={block.get('scannedCount')}"
        if top:
            line += f" | top1={top.get('name')} PBR={top.get('displayValue')}"
        print(line)


def main() -> int:
    print("=== 1. Code path - KR ignores Yahoo PBR ===")
    from dart_service import resolve_price_to_book

    kr = resolve_price_to_book(
        "005930.KS", price=70000, yahoo_pbr=1.23, info={"bookValue": 50000}, use_dart=False
    )
    us = resolve_price_to_book("AAPL", price=200, yahoo_pbr=45.0, info={}, use_dart=False)
    print(f"  005930.KS (yahoo=1.23) -> {kr}  (None = DART-only, Yahoo ignored)")
    print(f"  AAPL (yahoo=45) -> {us}  (expect 45)")

    print("\n=== 2. Render /api/dart/ping ===")
    ping = http_json(f"{RENDER}/api/dart/ping", timeout=60)
    sample = ping.get("sample") or {}
    print(f"  configured={ping.get('configured')} reachable={ping.get('dartReachable')}")
    print(f"  metricsOk={ping.get('metricsOk')} sample bps={sample.get('bps')} eps={sample.get('eps')}")

    print("\n=== 3. Local snapshot ===")
    if SNAPSHOT.is_file():
        print_market_pbr("repo data/stock-fundamentals.json", json.loads(SNAPSHOT.read_text(encoding="utf-8")))
    else:
        print("  (no local snapshot)")

    print("\n=== 4. Render GET /api/stock-fundamentals ===")
    try:
        print_market_pbr("Render API", http_json(f"{RENDER}/api/stock-fundamentals", timeout=120))
    except Exception as exc:
        print(f"  fetch failed: {exc}")

    print(
        "\nNOTE: PBR count>0 requires post-v141 rescan (Re or cron fast=false chunks). "
        "Ping BPS null does not block full fetch_dart_per_share during scan."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
