"""assets/dino 한글 PNG → js/dino-static.js 생성."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
ASSETS = ROOT / "assets" / "dino"
OUT = ROOT / "js" / "dino-static.js"
VARIANTS = 3

sys.path.insert(0, str(BACKEND))
from dino_catalog import CATALOG, ERAS, ERA_INTROS, FEATURED_BY_ERA  # noqa: E402


def static_images(name: str) -> list[str]:
    imgs: list[str] = []
    for slot in range(1, VARIANTS + 1):
        fn = f"{name}_{slot}.png"
        if (ASSETS / fn).is_file():
            imgs.append(f"assets/dino/{fn}")
    return imgs


def featured_rows(era_id: str) -> list[dict]:
    order = FEATURED_BY_ERA.get(era_id) or []
    by_id = {r["id"]: r for r in CATALOG[era_id]}
    return [dict(by_id[dino_id]) for dino_id in order if dino_id in by_id]


def enrich(row: dict, era_id: str) -> dict:
    era = next(e for e in ERAS if e["id"] == era_id)
    name = str(row.get("name") or "")
    imgs = static_images(name)
    primary = imgs[0] if imgs else ""
    return {
        "id": row["id"],
        "era": era_id,
        "era_label": era["label"],
        "period_ko": era["period_ko"],
        "name": name,
        "name_en": row.get("name_en") or row.get("api_name", ""),
        "diet": row.get("diet", ""),
        "length": row.get("length", ""),
        "weight": row.get("weight", ""),
        "height": row.get("height", ""),
        "description": row.get("description", ""),
        "static_images": imgs,
        "static_image": primary,
        "image_url": primary,
        "thumb_url": primary,
        "image_source": "local" if imgs else "pixabay",
    }


def main() -> None:
    eras_out: list[dict] = []
    for era in ERAS:
        intro = dict(ERA_INTROS.get(era["id"], {}))
        if era["id"] == "triassic" and (ASSETS / "삽엽기_1.png").is_file():
            intro["intro_image_url"] = "assets/dino/삽엽기_1.png"
        else:
            intro["intro_image_url"] = intro.get("intro_image_url") or ""
        eras_out.append({**era, **intro})

    catalog = {era_id: [enrich(row, era_id) for row in featured_rows(era_id)] for era_id in CATALOG}

    total_imgs = sum(
        len(d.get("static_images") or [])
        for rows in catalog.values()
        for d in rows
    )

    payload = {
        "eras": eras_out,
        "catalog": catalog,
        "static_image_count": total_imgs,
        "variants_per_dino": VARIANTS,
    }
    OUT.write_text("window.DINO_STATIC = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    print(f"Wrote {OUT} ({total_imgs} images)")


if __name__ == "__main__":
    main()
