"""누락된 _2/_3 재시도 및 소스 폴더 PNG로 _1 교체."""

from __future__ import annotations

import shutil
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "backend"))

import fetch_dino_pngs as fd  # noqa: E402


def refresh_primary_from_source() -> None:
    for row in fd.featured_rows():
        name = str(row["name"])
        dino_id = row["id"]
        src = fd.find_source_file(name, dino_id)
        if not src:
            continue
        out = fd.ASSETS / f"{name}_1.png"
        if src.resolve() == out.resolve():
            continue
        shutil.copy2(src, out)
        shutil.copy2(src, fd.BUNDLED / f"{name}_1.png")
        print(f"[refresh _1] {name} <- {src.name}")


def retry_missing() -> None:
    for row in fd.featured_rows():
        name = str(row["name"])
        dino_id = row["id"]
        has1 = (fd.ASSETS / f"{name}_1.png").is_file()
        for slot in range(2, fd.VARIANTS + 1):
            out = fd.ASSETS / f"{name}_{slot}.png"
            if out.is_file() and out.stat().st_size > 100000:
                continue
            pick = slot - 2 if has1 else slot - 1
            print(f"[retry] {name}_{slot} pick={pick}")
            data = fd.download_bytes(dino_id, pick)
            if data and len(data) > 50000:
                fd.save_png(out, data)
                fd.save_png(fd.BUNDLED / f"{name}_{slot}.png", data)
                print(f"  ok {len(data)//1024}KB")
            elif has1:
                one = fd.ASSETS / f"{name}_1.png"
                shutil.copy2(one, out)
                shutil.copy2(one, fd.BUNDLED / f"{name}_{slot}.png")
                print("  fallback copy _1")
            time.sleep(2.5)


if __name__ == "__main__":
    refresh_primary_from_source()
    retry_missing()
