"""KOSPI PBR 청크 스캔 테스트 — Render cron 또는 로컬 batch."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

RENDER = os.getenv("STOCK_API_URL", "https://first-stock-api.onrender.com").rstrip("/")
CHUNK = 5
MAX_CHUNKS = 6  # 30종목 샘플 (전체 176은 MAX_CHUNKS=None)


def http_json(url: str, *, method: str = "GET", headers: dict | None = None, timeout: int = 120) -> dict:
    req = urllib.request.Request(
        url,
        method=method,
        headers={"User-Agent": "DigitalWorld-ChunkTest/1.0", **(headers or {})},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run_render_cron_chunks() -> dict | None:
    secret = os.getenv("CRON_SECRET", "").strip()
    if not secret:
        print("CRON_SECRET not set — skip Render cron POST test")
        return None

    offset = 0
    last: dict | None = None
    chunks = 0
    while True:
        chunks += 1
        if MAX_CHUNKS and chunks > MAX_CHUNKS:
            print(f"  stopped after {MAX_CHUNKS} chunks (sample)")
            break
        url = (
            f"{RENDER}/api/fundamentals/cron/build"
            f"?market=kospi&offset={offset}&limit={CHUNK}&fast=false"
        )
        print(f"POST chunk offset={offset} limit={CHUNK} …")
        try:
            last = http_json(url, method="POST", headers={"Authorization": f"Bearer {secret}"}, timeout=180)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            print(f"  HTTP {exc.code}: {body[:300]}")
            return None
        print(
            f"  scanned={last.get('scannedCount')} done={last.get('done')} "
            f"pbrRows={last.get('pbrRowsWithValue')} pbrTop={last.get('pbrTopCount')}"
        )
        if last.get("done"):
            break
        offset = int(last.get("nextOffset") or offset + CHUNK)
    return last


def run_local_chunks() -> dict | None:
    if not os.getenv("OPEN_DART_API_KEY", "").strip():
        print("OPEN_DART_API_KEY not set — skip local batch")
        return None
    from stock_fundamentals_batch import build_and_save_batch_market

    offset = 0
    last: dict | None = None
    chunks = 0
    while True:
        chunks += 1
        if MAX_CHUNKS and chunks > MAX_CHUNKS:
            break
        last = build_and_save_batch_market("kospi", offset=offset, limit=CHUNK, fast=False)
        print(
            f"local chunk offset={offset}: scanned={last.get('scannedCount')} "
            f"pbrRows={last.get('pbrRowsWithValue')} done={last.get('done')}"
        )
        if last.get("done"):
            break
        offset = int(last.get("nextOffset") or offset + CHUNK)
    return last


def print_snapshot_pbr() -> None:
    try:
        payload = http_json(f"{RENDER}/api/stock-fundamentals", timeout=120)
    except Exception as exc:
        print(f"GET fundamentals failed: {exc}")
        return
    block = (payload.get("markets") or {}).get("kospi") or {}
    pbr = (block.get("rankings") or {}).get("pbr") or {}
    print(
        f"Render snapshot: kospi PBR count={pbr.get('count', 0)} "
        f"scanned={block.get('scannedCount')} updated={payload.get('updatedAt')}"
    )
    for item in (pbr.get("items") or [])[:3]:
        print(f"  top{item.get('rank')}: {item.get('name')} PBR={item.get('displayValue')}")


def main() -> int:
    print("=== KOSPI PBR chunk test ===\n")
    print("1) Local batch (OPEN_DART_API_KEY)")
    local = run_local_chunks()
    print("\n2) Render cron (CRON_SECRET)")
    remote = run_render_cron_chunks()
    print("\n3) Render snapshot after chunks")
    print_snapshot_pbr()

    ok = False
    for result in (local, remote):
        if not result:
            continue
        if (result.get("pbrRowsWithValue") or 0) > 0 or (result.get("pbrTopCount") or 0) > 0:
            ok = True
    if not ok:
        print("\nRESULT: no PBR rows in chunk responses yet — check DART BPS or deploy v144+")
        return 1
    print("\nRESULT: PBR values detected in chunk scan")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
