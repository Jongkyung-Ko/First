"""Render DART metrics — KOSPI TOP 10 diagnostic."""

from __future__ import annotations

import json
import sys
import urllib.request

RENDER = "https://first-stock-api.onrender.com"

TOP10 = [
    ("005930", "삼성전자"),
    ("000660", "SK하이닉스"),
    ("402340", "SK스퀘어"),
    ("009150", "삼성전기"),
    ("005380", "현대차"),
    ("373220", "LG에너지솔루션"),
    ("028260", "삼성물산"),
    ("032830", "삼성생명"),
    ("207940", "삼성바이오로직스"),
    ("329180", "HD현대중공업"),
]


def http_json(url: str, *, timeout: int = 90) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "DigitalWorld-Diag/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    print("=== DART ping ===")
    ping = http_json(f"{RENDER}/api/dart/ping", timeout=60)
    print(json.dumps(ping, ensure_ascii=False, indent=2))

    print("\n=== TOP 10 KOSPI /api/dart/metrics ===")
    ok = 0
    for code, name in TOP10:
        try:
            data = http_json(f"{RENDER}/api/dart/metrics/{code}", timeout=120)
            dart = data.get("dart") or {}
            eps, bps, pbr = dart.get("eps"), dart.get("bps"), data.get("pbr")
            status = "OK" if pbr and pbr > 0 else "NULL"
            if status == "OK":
                ok += 1
            print(
                f"{code} {name}: {status} | price={data.get('price')} "
                f"eps={eps} bps={bps} pbr={pbr}"
            )
        except Exception as exc:
            print(f"{code} {name}: ERROR {exc}")

    print(f"\nSUMMARY: {ok}/10 with PBR")
    return 0 if ok >= 8 else 1


if __name__ == "__main__":
    raise SystemExit(main())
