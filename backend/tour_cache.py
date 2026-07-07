"""Disk cache for Tour page images — downloaded during daily edition refresh."""

from __future__ import annotations

import json
import os
import re
import shutil
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from tour_service import TOUR_UA, _image_fingerprint

KST = timezone(timedelta(hours=9))
TOUR_IMAGE_MAX_BYTES = 3_500_000
TOUR_CACHE_KEEP_DAYS = 7
TOUR_DOWNLOAD_WORKERS = 8


def cache_root() -> Path:
    custom = os.getenv("TOUR_CACHE_DIR", "").strip()
    if custom:
        return Path(custom)
    return Path(__file__).resolve().parent / "data" / "tour-cache"


def _meta_path() -> Path:
    return cache_root() / "meta.json"


def _edition_dir(edition_date: str) -> Path:
    safe = re.sub(r"[^0-9\-]", "", str(edition_date or "").strip()) or "unknown"
    return cache_root() / "images" / safe


def _safe_id(raw: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9._-]", "_", str(raw or "").strip())
    return clean[:120] or "item"


def tour_image_api_path(edition_date: str, image_id: str) -> str:
    edition = urllib.parse.quote(str(edition_date or "").strip())
    image = urllib.parse.quote(_safe_id(image_id), safe="")
    return f"/api/tour/image?edition={edition}&id={image}"


def _ext_for_content_type(content_type: str) -> str:
    lowered = (content_type or "").lower()
    if "png" in lowered:
        return "png"
    if "webp" in lowered:
        return "webp"
    if "gif" in lowered:
        return "gif"
    return "jpg"


def _fetch_bytes(url: str, *, timeout: int = 45, max_bytes: int = TOUR_IMAGE_MAX_BYTES) -> tuple[bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": TOUR_UA, "Accept": "image/*,*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read(max_bytes)
        content_type = resp.headers.get("Content-Type", "image/jpeg")
    if not data:
        raise ValueError("Empty image response")
    return data, content_type


def _image_file(edition_date: str, image_id: str) -> Path | None:
    base = _edition_dir(edition_date) / _safe_id(image_id)
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        path = base.with_suffix(ext)
        if path.is_file():
            return path
    return None


def _image_path_for_write(edition_date: str, image_id: str, ext: str) -> Path:
    return _edition_dir(edition_date) / f"{_safe_id(image_id)}.{ext.lstrip('.')}"


def _read_meta() -> dict[str, Any]:
    path = _meta_path()
    if not path.is_file():
        return {"editions": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            editions = data.get("editions")
            if isinstance(editions, dict):
                return data
    except (OSError, json.JSONDecodeError):
        pass
    return {"editions": {}}


def _write_meta(meta: dict[str, Any]) -> None:
    path = _meta_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def _lookup_source_url(edition_date: str, image_id: str) -> str:
    meta = _read_meta()
    edition = meta.get("editions", {}).get(str(edition_date), {})
    images = edition.get("images") if isinstance(edition, dict) else {}
    if isinstance(images, dict):
        source = str(images.get(_safe_id(image_id)) or "").strip()
        if source.startswith("http"):
            return source
    return ""


def _remember_source_url(edition_date: str, image_id: str, source_url: str) -> None:
    if not source_url.startswith("http"):
        return
    meta = _read_meta()
    editions = meta.setdefault("editions", {})
    edition = editions.setdefault(str(edition_date), {"images": {}})
    images = edition.setdefault("images", {})
    images[_safe_id(image_id)] = source_url
    _write_meta(meta)


def _download_image(edition_date: str, image_id: str, url: str) -> str | None:
    if not url or not str(url).startswith("http"):
        return None
    try:
        data, content_type = _fetch_bytes(url)
    except Exception:
        return None
    ext = _ext_for_content_type(content_type)
    path = _image_path_for_write(edition_date, image_id, ext)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    _remember_source_url(edition_date, image_id, url)
    return tour_image_api_path(edition_date, image_id)


def load_tour_image(edition_date: str, image_id: str) -> tuple[bytes, str]:
    path = _image_file(edition_date, image_id)
    if not path:
        source_url = _lookup_source_url(edition_date, image_id)
        if source_url:
            _download_image(edition_date, image_id, source_url)
            path = _image_file(edition_date, image_id)
    if not path:
        raise FileNotFoundError(f"Tour image not found: {edition_date}/{image_id}")
    ext = path.suffix.lower()
    content_type = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(ext, "image/jpeg")
    return path.read_bytes(), content_type


def _make_image_id(place_slug: str, role: str, item: dict[str, Any]) -> str:
    fp = _image_fingerprint(item) or role
    return _safe_id(f"{place_slug}_{role}_{fp}")


def _cache_image_item(edition_date: str, image_id: str, item: dict[str, Any]) -> dict[str, Any]:
    row = dict(item)
    source_url = str(row.get("url") or row.get("thumb_url") or "").strip()
    if source_url.startswith("/api/"):
        source_url = str(row.get("source_url") or "").strip()
    if not source_url.startswith("http"):
        return row

    row["source_url"] = source_url
    local = _download_image(edition_date, image_id, source_url)
    if local:
        row["url"] = local
        row["thumb_url"] = local
        row["cached"] = True
    else:
        row["cached"] = False
    return row


def _collect_cache_jobs(edition_date: str, categories: list[dict[str, Any]]) -> list[tuple[str, str, dict[str, Any]]]:
    jobs: list[tuple[str, str, dict[str, Any]]] = []
    for cat in categories:
        for place in cat.get("places") or []:
            if not isinstance(place, dict):
                continue
            slug = str(place.get("slug") or place.get("city") or "place")
            hero = place.get("hero")
            if isinstance(hero, dict) and hero.get("url"):
                jobs.append((slug, "hero", hero))
            for idx, image in enumerate(place.get("gallery") or []):
                if isinstance(image, dict) and image.get("url"):
                    jobs.append((slug, f"g{idx}", image))
    return jobs


def cache_edition_images(edition_date: str, categories: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Download hero/gallery images for an edition and rewrite URLs to /api/tour/image."""
    edition_key = str(edition_date or "").strip()
    if not edition_key:
        return categories

    jobs = _collect_cache_jobs(edition_key, categories)
    if not jobs:
        return categories

    cached_by_key: dict[tuple[str, str], dict[str, Any]] = {}

    def _run(job: tuple[str, str, dict[str, Any]]) -> tuple[str, str, dict[str, Any]]:
        slug, role, item = job
        image_id = _make_image_id(slug, role, item)
        return slug, role, _cache_image_item(edition_key, image_id, item)

    with ThreadPoolExecutor(max_workers=TOUR_DOWNLOAD_WORKERS) as pool:
        futures = [pool.submit(_run, job) for job in jobs]
        for fut in as_completed(futures):
            try:
                slug, role, cached = fut.result()
                cached_by_key[(slug, role)] = cached
            except Exception:
                pass

    out_categories: list[dict[str, Any]] = []
    for cat in categories:
        cat_copy = dict(cat)
        built_places: list[dict[str, Any]] = []
        for place in cat.get("places") or []:
            if not isinstance(place, dict):
                continue
            place_copy = dict(place)
            slug = str(place.get("slug") or place.get("city") or "place")
            hero = place.get("hero")
            if isinstance(hero, dict):
                place_copy["hero"] = cached_by_key.get((slug, "hero"), hero)
            gallery_out: list[dict[str, Any]] = []
            for idx, image in enumerate(place.get("gallery") or []):
                if isinstance(image, dict):
                    gallery_out.append(cached_by_key.get((slug, f"g{idx}"), image))
            place_copy["gallery"] = gallery_out
            built_places.append(place_copy)
        cat_copy["places"] = built_places
        out_categories.append(cat_copy)

    _prune_old_editions(keep_edition=edition_key)
    return out_categories


def _prune_old_editions(*, keep_edition: str) -> None:
    try:
        keep_day = date.fromisoformat(str(keep_edition))
    except ValueError:
        return
    cutoff = keep_day - timedelta(days=TOUR_CACHE_KEEP_DAYS)
    images_root = cache_root() / "images"
    if not images_root.is_dir():
        return

    meta = _read_meta()
    editions = meta.get("editions", {})
    for child in images_root.iterdir():
        if not child.is_dir():
            continue
        try:
            edition_day = date.fromisoformat(child.name)
        except ValueError:
            continue
        if edition_day < cutoff:
            shutil.rmtree(child, ignore_errors=True)
            editions.pop(child.name, None)
    meta["editions"] = editions
    _write_meta(meta)
