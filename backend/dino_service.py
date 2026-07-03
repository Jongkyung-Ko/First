"""Dinosaur gallery — facts API proxy, Wikimedia images, Korean catalog."""

from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from dino_catalog import CATALOG, ERAS

DINO_API_BASES = (
    "https://dinosaur-facts-api.shorthair.fr",
    "https://dinosaur-facts-api.shultzlab.com",
)
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
UA = "DigitalWorld-Dino/1.0 (educational; github.com/Jongkyung-Ko/First)"

_api_desc_cache: dict[str, str] | None = None
_image_url_cache: dict[str, tuple[float, str]] = {}
_IMAGE_CACHE_TTL = 86400 * 7


def _image_dir() -> Path:
    return Path(__file__).resolve().parent / "data" / "dino-images"


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


def _fetch_api_dino(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "", name.lower())
    for base in DINO_API_BASES:
        try:
            data = _fetch_json(f"{base}/dinosaurs/{slug}", timeout=15)
            if isinstance(data, dict):
                desc = str(data.get("Description") or data.get("description") or "").strip()
                if desc:
                    return desc
            if isinstance(data, list) and data:
                desc = str(data[0].get("Description") or "").strip()
                if desc:
                    return desc
        except Exception:
            continue
    return _load_api_descriptions().get(name.lower(), "")


def _commons_search_image(query: str, *, width: int = 640) -> str:
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": query,
        "gsrnamespace": "6",
        "gsrlimit": "8",
        "prop": "imageinfo",
        "iiprop": "url|mime",
        "iiurlwidth": str(max(120, min(width, 1280))),
        "format": "json",
    }
    url = f"{COMMONS_API}?{urllib.parse.urlencode(params)}"
    data = _fetch_json(url, timeout=25)
    pages = (data.get("query") or {}).get("pages") or {}
    for page in pages.values():
        info_list = page.get("imageinfo") or []
        if not info_list:
            continue
        info = info_list[0]
        mime = str(info.get("mime") or "")
        if not mime.startswith("image/"):
            continue
        image_url = str(info.get("thumburl") or info.get("url") or "").strip()
        if image_url:
            return image_url
    return ""


def _resolve_image_url(dino_id: str, name_en: str, *, width: int = 640) -> str:
    cache_key = f"{dino_id}:{width}"
    cached = _image_url_cache.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1]

    folder = _image_dir()
    for ext in (".jpg", ".jpeg", ".webp", ".png"):
        disk = folder / f"{dino_id}{ext}"
        if disk.is_file():
            url = f"/api/dino/image-file/{dino_id}"
            _image_url_cache[cache_key] = (time.time() + _IMAGE_CACHE_TTL, url)
            return url

    return ""


def fetch_dino_image(dino_id: str, *, width: int = 640) -> tuple[bytes, str]:
    slug = re.sub(r"[^a-z0-9_-]", "", (dino_id or "").strip().lower())
    if not slug:
        raise ValueError("Invalid dinosaur id")

    try:
        return read_cached_image(slug)
    except FileNotFoundError:
        pass

    row = None
    for era_rows in CATALOG.values():
        for item in era_rows:
            if item["id"] == slug:
                row = item
                break
        if row:
            break
    if not row:
        raise ValueError("Unknown dinosaur")

    name_en = str(row.get("name_en") or row.get("api_name") or slug)
    queries = (
        f"{name_en} dinosaur",
        f"{name_en} dinosaur fossil",
        f"{slug} dinosaur",
    )
    remote = ""
    for q in queries:
        try:
            remote = _commons_search_image(q, width=width)
        except Exception:
            remote = ""
        if remote:
            break
    if not remote:
        raise FileNotFoundError("No image found")

    req = urllib.request.Request(remote, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read(900_000)
        ctype = resp.headers.get("Content-Type", "image/jpeg")
    if not data:
        raise FileNotFoundError("Empty image")

    folder = _image_dir()
    folder.mkdir(parents=True, exist_ok=True)
    ext = ".png" if "png" in ctype.lower() else ".jpg"
    (folder / f"{slug}{ext}").write_bytes(data)
    cache_key = f"{slug}:{width}"
    _image_url_cache[cache_key] = (time.time() + _IMAGE_CACHE_TTL, f"/api/dino/image-file/{slug}")
    return data, ctype if ctype.startswith("image/") else "image/jpeg"


def _image_urls_for(dino_id: str) -> tuple[str, str]:
    cached = _resolve_image_url(dino_id, dino_id, width=640)
    if cached:
        return cached, cached
    return f"/api/dino/image/{dino_id}?w=720", f"/api/dino/image/{dino_id}?w=240"


def _enrich_dino(row: dict[str, Any], era_id: str) -> dict[str, Any]:
    era = next((e for e in ERAS if e["id"] == era_id), {})
    api_name = str(row.get("api_name") or row.get("name_en") or "")
    api_desc = _load_api_descriptions().get(api_name.lower(), "")

    dino_id = str(row["id"])
    name_en = str(row.get("name_en") or api_name)
    image_url, thumb_url = _image_urls_for(dino_id)

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
    }


def list_eras() -> dict[str, Any]:
    return {"kind": "dino_eras", "eras": ERAS}


def list_dinosaurs(era_id: str) -> dict[str, Any]:
    era = era_id.strip().lower()
    if era not in CATALOG:
        raise ValueError("지원하지 않는 시대입니다. (cretaceous, jurassic)")
    rows = [_enrich_dino(dict(item), era) for item in CATALOG[era]]
    era_meta = next((e for e in ERAS if e["id"] == era), {})
    return {
        "kind": "dino_list",
        "era": era,
        "era_label": era_meta.get("label", ""),
        "period_ko": era_meta.get("period_ko", ""),
        "count": len(rows),
        "dinosaurs": rows,
    }


def read_cached_image(dino_id: str) -> tuple[bytes, str]:
    slug = re.sub(r"[^a-z0-9_-]", "", (dino_id or "").strip().lower())
    if not slug:
        raise ValueError("Invalid dinosaur id")
    folder = _image_dir()
    for ext, ctype in (
        (".jpg", "image/jpeg"),
        (".jpeg", "image/jpeg"),
        (".png", "image/png"),
        (".webp", "image/webp"),
    ):
        path = folder / f"{slug}{ext}"
        if path.is_file():
            return path.read_bytes(), ctype
    raise FileNotFoundError("Image not cached")
