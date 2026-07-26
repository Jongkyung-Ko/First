"""공룡 PNG 3장씩 한글 파일명으로 assets/dino 에 저장."""

from __future__ import annotations

import shutil
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
ASSETS = ROOT / "assets" / "dino"
BUNDLED = BACKEND / "data" / "dino-images-bundled"
SOURCE_DIRS = [
    Path(r"C:\AI_PJT\Digitla_World_Image\공룡이미지2"),
    Path(r"C:\AI_PJT\Digitla_World_Image\공룡이미지"),
    Path(r"C:\AI_PJT\Digitla_World_Image"),
    ASSETS,
]
# 카탈로그 한글명 ↔ 파일명 차이 (르/루, 애/에, 오/하 등)
NAME_ALIASES: dict[str, list[str]] = {
    "스테고사우루스": ["스테고사우르스"],
    "브라키오사우루스": ["브라키오사우르스"],
    "메갈로사우루스": ["메갈로사우르스"],
    "멜라노로사우루스": ["멜라노로사우르스"],
    "스타우리코사우루스": ["스타우리코사우르스"],
    "켄트로사우루스": ["켄트로사우르스"],
    "테코돈토사우루스": ["테코돈토사우르스"],
    "헤레라사우루스": ["헤레라사우르스"],
    "플라테오사우루스": ["플라테오사우르스"],
    "에오랩터": ["애오랩터"],
    "리오하사우루스": ["리하오사우르스", "리오하사우르스"],
}
RENDER_API = "https://first-stock-api.onrender.com"
VARIANTS = 3

sys.path.insert(0, str(BACKEND))
from dino_catalog import CATALOG, ERA_INTROS, FEATURED_BY_ERA  # noqa: E402
from dino_service import fetch_pixabay_dino_bytes  # noqa: E402


def featured_rows() -> list[dict]:
    rows: list[dict] = []
    for era_id, ids in FEATURED_BY_ERA.items():
        by_id = {r["id"]: r for r in CATALOG[era_id]}
        for dino_id in ids:
            if dino_id in by_id:
                rows.append(dict(by_id[dino_id]))
    return rows


def find_source_file(korean_name: str, dino_id: str) -> Path | None:
    candidates = [korean_name] + NAME_ALIASES.get(korean_name, [])
    for folder in SOURCE_DIRS:
        if not folder.is_dir():
            continue
        for base in candidates:
            for name in (f"{base}.png", f"{dino_id}.png"):
                path = folder / name
                if path.is_file():
                    return path
    return None


def save_png(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def download_bytes(dino_id: str, pick: int) -> bytes | None:
    try:
        data, ctype = fetch_pixabay_dino_bytes(dino_id, pick_index=pick, width=720)
        return data
    except Exception as exc:
        print(f"  local pixabay pick={pick} fail: {exc}")

    url = f"{RENDER_API}/api/dino/image/{dino_id}?w=720&pick={pick}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "DigitalWorld-Dino-Fetch/1.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.read()
    except Exception as exc:
        print(f"  render pick={pick} fail: {exc}")
        return None


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    BUNDLED.mkdir(parents=True, exist_ok=True)

    ok = 0
    skip = 0
    fail = 0

    for row in featured_rows():
        dino_id = row["id"]
        name = str(row["name"])
        print(f"\n[{dino_id}] {name}")

        manual_slots: set[int] = set()
        for slot in range(1, VARIANTS + 1):
            out = ASSETS / f"{name}_{slot}.png"
            bundled = BUNDLED / f"{name}_{slot}.png"
            if out.is_file() and out.stat().st_size > 5000:
                shutil.copy2(out, bundled)
                print(f"  _{slot} exists")
                skip += 1
                if slot == 1:
                    manual_slots.add(1)
                continue

            if slot == 1:
                src = find_source_file(name, dino_id)
                if src:
                    shutil.copy2(src, out)
                    shutil.copy2(src, bundled)
                    manual_slots.add(1)
                    print(f"  _1 copied from {src.name}")
                    ok += 1
                    continue

            pick = slot - 1
            if 1 in manual_slots and slot > 1:
                pick = slot - 2

            data = download_bytes(dino_id, pick)
            if not data or len(data) < 5000:
                print(f"  _{slot} FAILED")
                fail += 1
                time.sleep(1)
                continue

            save_png(out, data)
            save_png(bundled, data)
            print(f"  _{slot} downloaded ({len(data) // 1024}KB, pick={pick})")
            ok += 1
            time.sleep(0.8)

    tri_intro = ERA_INTROS.get("triassic", {})
    era_src = find_source_file("삽엽기 공룡", "era-triassic")
    if era_src:
        for label, fname in (("삽엽기_1", "삽엽기_1.png"),):
            out = ASSETS / fname
            bundled = BUNDLED / fname
            if not out.is_file():
                shutil.copy2(era_src, out)
                shutil.copy2(era_src, bundled)
                print(f"\n[era-triassic] saved {fname}")

    print(f"\nDone: ok={ok} skip={skip} fail={fail}")


if __name__ == "__main__":
    main()
