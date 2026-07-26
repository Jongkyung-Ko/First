"""Open DART + Render 연동 진단 (로컬 또는 Render 키)."""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

RENDER = "https://first-stock-api.onrender.com"


def http_json(url: str, *, timeout: int = 90) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "DigitalWorld-Diag/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    print("=== 1. Render /health ===")
    health = http_json(f"{RENDER}/health", timeout=30)
    print(json.dumps(health, ensure_ascii=False, indent=2))

    print("\n=== 2. Render fundamentals (KOSPI rankings) ===")
    try:
        payload = http_json(f"{RENDER}/api/stock-fundamentals?region=kospi", timeout=120)
        print("source:", payload.get("source"))
        print("dartConfigured:", payload.get("dartConfigured"))
        print("updatedAt:", payload.get("updatedAt"))
        market = (payload.get("markets") or {}).get("kospi") or {}
        print("scannedCount:", market.get("scannedCount"), "errorCount:", market.get("errorCount"))
        for key in ("per", "pbr", "roe", "dividend"):
            block = (market.get("rankings") or {}).get(key) or {}
            items = block.get("items") or []
            line = f"  {key}: count={block.get('count', len(items))}"
            if items:
                top = items[0]
                line += f" | top1={top.get('name')} {top.get('displayValue')}"
            print(line)
    except Exception as exc:
        print("fundamentals fetch failed:", exc)

    print("\n=== 3. Local OPEN_DART_API_KEY direct test ===")
    from dart_service import (
        dart_api_key,
        dart_configured,
        fetch_dart_per_share,
        resolve_price_to_book,
        resolve_trailing_pe,
        _load_corp_map,
    )

    if not dart_configured():
        print("LOCAL KEY: not set - set OPEN_DART_API_KEY to run live DART test locally.")
        print("Render has openDartConfigured from env; use section 2 after Re scan.")
        return 0

    key_len = len(dart_api_key())
    print(f"LOCAL KEY: set (length={key_len})")

    corp = _load_corp_map(force=True)
    print(f"corp map size: {len(corp)}")
    samsung_corp = corp.get("005930")
    print(f"005930 corp_code: {samsung_corp or 'NOT FOUND'}")

    metrics = fetch_dart_per_share("005930")
    print(f"005930 DART metrics: {metrics}")

    import yfinance as yf

    info = yf.Ticker("005930.KS").info or {}
    price = float(info.get("currentPrice") or info.get("regularMarketPrice") or 0)
    pe = resolve_trailing_pe("005930.KS", price=price, yahoo_trailing_pe=None, info=info)
    pbr = resolve_price_to_book("005930.KS", price=price, yahoo_pbr=None, info=info)
    print(f"005930.KS price={price:,.0f} resolved PER={pe} PBR={pbr}")

    ok = metrics.get("eps") and metrics.get("bps") and pe and pbr
    print("\nRESULT:", "PASS" if ok else "PARTIAL/FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
