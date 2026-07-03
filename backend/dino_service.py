"""Dinosaur gallery — facts API proxy, Pixabay images, Korean catalog."""

from __future__ import annotations

import json
import os
import re
import time
import urllib.parse
import urllib.request
import zlib
from pathlib import Path
from typing import Any

from dino_catalog import CATALOG, ERA_INTROS, ERAS

DINO_API_BASES = (
    "https://dinosaur-facts-api.shorthair.fr",
    "https://dinosaur-facts-api.shultzlab.com",
)
PIXABAY_API = "https://pixabay.com/api/"
UA = "DigitalWorld-Dino/1.0 (educational; github.com/Jongkyung-Ko/First)"

_api_desc_cache: dict[str, str] | None = None
_image_url_cache: dict[str, tuple[float, str]] = {}
_IMAGE_CACHE_TTL = 86400 * 7


def _pixabay_api_key() -> str:
    key = (os.environ.get("PIXABAY_API_KEY") or os.environ.get("PIXABAY_KEY") or "").strip()
    if not key:
        raise ValueError("PIXABAY_API_KEY 환경변수가 설정되지 않았습니다.")
    return key


_FOSSIL_KEYWORDS = frozenset(
    {
        "fossil",
        "fossils",
        "skeleton",
        "skull",
        "bone",
        "bones",
        "excavation",
        "museum",
        "specimen",
        "paleontology",
        "amber",
        "footprint",
        "trackway",
        "dig",
        "archaeology",
    }
)
_ART_POSITIVE = frozenset({"illustration", "drawing", "art", "render", "3d", "cartoon", "painting", "vector"})


def _image_dir() -> Path:
    return Path(__file__).resolve().parent / "data" / "dino-images-art"


def _bundled_image_dir() -> Path:
    return Path(__file__).resolve().parent / "data" / "dino-images-bundled"


def _find_image_path(disk: str) -> Path | None:
    for folder in (_bundled_image_dir(), _image_dir()):
        for ext in (".png", ".jpg", ".jpeg", ".webp"):
            path = folder / f"{disk}{ext}"
            if path.is_file():
                return path
    return None


def _find_catalog_row(dino_id: str) -> dict[str, Any] | None:
    slug = re.sub(r"[^a-z0-9_-]", "", (dino_id or "").strip().lower())
    if not slug:
        return None
    for era_rows in CATALOG.values():
        for item in era_rows:
            if item["id"] == slug:
                return item
    return None


def _disk_slug(dino_id: str) -> str:
    slug = re.sub(r"[^a-z0-9_-]", "", (dino_id or "").strip().lower())
    if not slug:
        return ""
    row = _find_catalog_row(slug)
    if row:
        rev = int(row.get("image_rev") or 1)
        if rev > 1:
            return f"{slug}-v{rev}"
    return slug


def _pick_index_for_slug(slug: str, *, image_rev: int = 1) -> int:
    if image_rev > 1:
        return max(0, image_rev - 1)
    clean = re.sub(r"[^a-z0-9_-]", "", (slug or "").strip().lower())
    if not clean:
        return 0
    return zlib.crc32(clean.encode("utf-8")) % 6


def _queries_for_dino(row: dict[str, Any]) -> tuple[str, ...]:
    custom = row.get("image_queries")
    if isinstance(custom, (list, tuple)):
        queries = tuple(str(q).strip() for q in custom if str(q).strip())
        if queries:
            return queries
    name_en = str(row.get("name_en") or row.get("api_name") or row.get("id") or "")
    slug = str(row.get("id") or "")
    return (
        f"{name_en} dinosaur illustration",
        f"{name_en} dinosaur 3d render",
        f"{name_en} prehistoric dinosaur art",
        f"{slug} dinosaur illustration",
    )


def _image_rev_query(dino_id: str, *, prefix: str = "&") -> str:
    row = _find_catalog_row(dino_id)
    rev = int(row.get("image_rev") or 1) if row else 1
    return f"{prefix}rev={rev}" if rev > 1 else ""


def _meta_path(disk_slug: str) -> Path:
    for folder in (_bundled_image_dir(), _image_dir()):
        path = folder / f"{disk_slug}.meta.json"
        if path.is_file():
            return path
    return _image_dir() / f"{disk_slug}.meta.json"


def _fetch_json(url: str, *, timeout: int = 25) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _load_api_descriptions() -> dict[str, str]:
    global _api_desc_cache
    if _api_desc_cache is not None:
        return _api_desc_cache
    out: dict[str, str] = {}
    for base in DINO_API_BASES:
        try:
            data = _fetch_json(f"{base}/dinosaurs", timeout=20)
            if isinstance(data, list):
                for row in data:
                    name = str(row.get("Name") or "").strip()
                    desc = str(row.get("Description") or "").strip()
                    if name and desc:
                        out[name.lower()] = desc
                break
        except Exception:
            continue
    _api_desc_cache = out
    return out


def _pick_pixabay_url(hit: dict[str, Any], *, width: int) -> str:
    if width <= 200:
        return str(hit.get("previewURL") or "").strip()
    if width <= 720:
        return str(hit.get("webformatURL") or hit.get("largeImageURL") or "").strip()
    return str(hit.get("largeImageURL") or hit.get("webformatURL") or "").strip()


def _hit_tags_text(hit: dict[str, Any]) -> str:
    return str(hit.get("tags") or "").lower()


def _is_fossil_like(hit: dict[str, Any]) -> bool:
    tags = _hit_tags_text(hit)
    return any(kw in tags for kw in _FOSSIL_KEYWORDS)


def _is_art_like(hit: dict[str, Any]) -> bool:
    tags = _hit_tags_text(hit)
    if _is_fossil_like(hit):
        return False
    if any(kw in tags for kw in _ART_POSITIVE):
        return True
    # illustration/vector hits from Pixabay are usually art
    return str(hit.get("type") or "").lower() in {"illustration", "vector"}


def _pixabay_search(
    query: str,
    *,
    width: int = 640,
    image_type: str = "illustration",
    pick_index: int = 0,
) -> tuple[str, dict[str, str]]:
    params = {
        "key": _pixabay_api_key(),
        "q": query,
        "image_type": image_type,
        "orientation": "horizontal",
        "safesearch": "true",
        "per_page": "20",
        "lang": "en",
    }
    url = f"{PIXABAY_API}?{urllib.parse.urlencode(params)}"
    data = _fetch_json(url, timeout=25)
    hits = data.get("hits") or []
    if not isinstance(hits, list):
        return "", {}

    art_hits: list[dict[str, Any]] = []
    for hit in hits:
        if not isinstance(hit, dict):
            continue
        if _is_fossil_like(hit) or not _is_art_like(hit):
            continue
        art_hits.append(hit)

    if pick_index < len(art_hits):
        hit = art_hits[pick_index]
    elif art_hits:
        hit = art_hits[0]
    else:
        return "", {}

    for hit in (hit,):
        image_url = _pick_pixabay_url(hit, width=width)
        if not image_url:
            continue
        meta = {
            "image_page_url": str(hit.get("pageURL") or "").strip(),
            "image_user": str(hit.get("user") or "").strip(),
            "image_tags": str(hit.get("tags") or "").strip(),
            "image_source": "pixabay",
            "image_kind": "art",
        }
        return image_url, meta
    return "", {}


def _search_art_images(
    queries: tuple[str, ...], *, width: int = 640, pick_index: int = 0
) -> tuple[str, dict[str, str]]:
    for q in queries:
        if not q:
            continue
        for image_type in ("illustration", "all"):
            try:
                remote, meta = _pixabay_search(
                    q, width=width, image_type=image_type, pick_index=pick_index
                )
            except Exception:
                remote, meta = "", {}
            if remote:
                return remote, meta
    return "", {}


def _save_image_meta(slug: str, meta: dict[str, str]) -> None:
    if not meta:
        return
    folder = _image_dir()
    folder.mkdir(parents=True, exist_ok=True)
    try:
        _meta_path(slug).write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass


def _read_image_meta(dino_id: str) -> dict[str, str]:
    path = _meta_path(_disk_slug(dino_id))
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _resolve_image_url(dino_id: str) -> str:
    cache_key = f"{dino_id}:file"
    cached = _image_url_cache.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1]

    disk = _disk_slug(dino_id)
    if _find_image_path(disk):
        url = f"/api/dino/image-file/{dino_id}{_image_rev_query(dino_id, prefix='?')}"
        _image_url_cache[cache_key] = (time.time() + _IMAGE_CACHE_TTL, url)
        return url
    return ""


def _image_urls_for(dino_id: str) -> tuple[str, str]:
    cached = _resolve_image_url(dino_id)
    rev_q = _image_rev_query(dino_id)
    if cached:
        return cached, cached
    return (
        f"/api/dino/image/{dino_id}?w=720{rev_q}",
        f"/api/dino/image/{dino_id}?w=240{rev_q}",
    )


def _era_image_slug(era_id: str) -> str:
    return f"era-{era_id.strip().lower()}"


def fetch_dino_image(dino_id: str, *, width: int = 640) -> tuple[bytes, str]:
    slug = re.sub(r"[^a-z0-9_-]", "", (dino_id or "").strip().lower())
    if not slug:
        raise ValueError("Invalid dinosaur id")
    disk = _disk_slug(slug)

    try:
        return read_cached_image(slug)
    except FileNotFoundError:
        pass

    if slug.startswith("era-"):
        era_id = slug[4:]
        intro = ERA_INTROS.get(era_id)
        if not intro:
            raise ValueError("Unknown era")
        base_query = str(intro.get("image_query") or f"{era_id} dinosaur").strip()
        queries = (
            f"{base_query} illustration",
            f"{era_id} dinosaur period art",
            f"{base_query} 3d",
        )
        remote, meta = _search_art_images(
            queries, width=width, pick_index=_pick_index_for_slug(era_id)
        )
        if not remote:
            raise FileNotFoundError("Pixabay에서 시대 복원 이미지를 찾지 못했습니다.")
    else:
        row = _find_catalog_row(slug)
        if not row:
            raise ValueError("Unknown dinosaur")

        queries = _queries_for_dino(row)
        pick_index = _pick_index_for_slug(slug, image_rev=int(row.get("image_rev") or 1))
        remote, meta = _search_art_images(queries, width=width, pick_index=pick_index)
        if not remote:
            raise FileNotFoundError("Pixabay에서 공룡 복원 이미지를 찾지 못했습니다.")

    req = urllib.request.Request(remote, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read(900_000)
        ctype = resp.headers.get("Content-Type", "image/jpeg")
    if not data:
        raise FileNotFoundError("Empty image")

    folder = _image_dir()
    folder.mkdir(parents=True, exist_ok=True)
    ext = ".png" if "png" in ctype.lower() else ".jpg"
    (folder / f"{disk}{ext}").write_bytes(data)
    _save_image_meta(disk, meta)
    cache_key = f"{slug}:file"
    _image_url_cache[cache_key] = (
        time.time() + _IMAGE_CACHE_TTL,
        f"/api/dino/image-file/{slug}{_image_rev_query(slug, prefix='?')}",
    )
    return data, ctype if ctype.startswith("image/") else "image/jpeg"


def _enrich_dino(row: dict[str, Any], era_id: str) -> dict[str, Any]:
    era = next((e for e in ERAS if e["id"] == era_id), {})
    api_name = str(row.get("api_name") or row.get("name_en") or "")
    api_desc = _load_api_descriptions().get(api_name.lower(), "")

    dino_id = str(row["id"])
    name_en = str(row.get("name_en") or api_name)
    image_url, thumb_url = _image_urls_for(dino_id)
    image_meta = _read_image_meta(dino_id)

    return {
        "id": dino_id,
        "era": era_id,
        "era_label": era.get("label", ""),
        "period_ko": era.get("period_ko", ""),
        "name": row.get("name", ""),
        "name_en": name_en,
        "diet": row.get("diet", ""),
        "length": row.get("length", ""),
        "weight": row.get("weight", ""),
        "height": row.get("height", ""),
        "description": row.get("description", ""),
        "api_description_en": api_desc,
        "image_url": image_url,
        "thumb_url": thumb_url or image_url,
        "image_source": image_meta.get("image_source", "bundled" if _find_image_path(_disk_slug(dino_id)) else "pixabay"),
        "image_page_url": image_meta.get("image_page_url", ""),
        "image_user": image_meta.get("image_user", ""),
    }


def list_eras() -> dict[str, Any]:
    enriched: list[dict[str, Any]] = []
    for era in ERAS:
        era_id = era["id"]
        intro = ERA_INTROS.get(era_id, {})
        era_slug = _era_image_slug(era_id)
        intro_image_url, _ = _image_urls_for(era_slug)
        intro_meta = _read_image_meta(era_slug)
        enriched.append(
            {
                **era,
                **intro,
                "intro_image_url": intro_image_url,
                "intro_image_page_url": intro_meta.get("image_page_url", ""),
                "intro_image_user": intro_meta.get("image_user", ""),
            }
        )
    return {"kind": "dino_eras", "eras": enriched, "image_provider": "pixabay", "image_kind": "art"}


def list_dinosaurs(era_id: str) -> dict[str, Any]:
    era = era_id.strip().lower()
    if era not in CATALOG:
        raise ValueError("지원하지 않는 시대입니다. (triassic, jurassic, cretaceous)")
    rows = [_enrich_dino(dict(item), era) for item in CATALOG[era]]
    era_meta = next((e for e in ERAS if e["id"] == era), {})
    return {
        "kind": "dino_list",
        "era": era,
        "era_label": era_meta.get("label", ""),
        "period_ko": era_meta.get("period_ko", ""),
        "count": len(rows),
        "image_provider": "pixabay",
        "image_kind": "art",
        "dinosaurs": rows,
    }


def read_cached_image(dino_id: str) -> tuple[bytes, str]:
    slug = re.sub(r"[^a-z0-9_-]", "", (dino_id or "").strip().lower())
    if not slug:
        raise ValueError("Invalid dinosaur id")
    disk = _disk_slug(slug)
    path = _find_image_path(disk)
    if path:
        ctype = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
        }.get(path.suffix.lower(), "image/jpeg")
        return path.read_bytes(), ctype
    raise FileNotFoundError("Image not cached")
