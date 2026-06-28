"""Disk cache for ART genre galleries — refreshed every 2 hours or on demand."""

from __future__ import annotations

import json
import os
import random
import shutil
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from art_service import (
    GENRES,
    _fetch_bytes,
    _fetch_met_works_from_ids,
    _met_search,
    _apply_korean_descriptions,
)

ART_CACHE_TTL_SECONDS = 2 * 3600
IMAGE_KINDS = ("thumb", "preview", "full")
KST = timezone(timedelta(hours=9))


def cache_root() -> Path:
    custom = os.getenv("ART_CACHE_DIR", "").strip()
    if custom:
        return Path(custom)
    return Path(__file__).resolve().parent / "data" / "art-cache"


def _genre_json_path(genre_id: str) -> Path:
    return cache_root() / "genres" / f"{genre_id}.json"


def _image_dir(genre_id: str) -> Path:
    return cache_root() / "images" / genre_id


def _image_file(genre_id: str, object_id: int | str, kind: str) -> Path | None:
    base = _image_dir(genre_id) / f"{object_id}_{kind}"
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        path = base.with_suffix(ext)
        if path.is_file():
            return path
    return None


def _image_path_for_write(genre_id: str, object_id: int | str, kind: str, ext: str) -> Path:
    return _image_dir(genre_id) / f"{object_id}_{kind}.{ext.lstrip('.')}"


def work_image_api_path(genre_id: str, object_id: int | str, kind: str) -> str:
    return f"/api/art/work-image?genre={genre_id}&id={object_id}&kind={kind}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _next_refresh_iso(from_iso: str | None = None) -> str:
    base = datetime.now(timezone.utc)
    if from_iso:
        try:
            base = datetime.fromisoformat(from_iso.replace("Z", "+00:00"))
            if base.tzinfo is None:
                base = base.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return (base + timedelta(seconds=ART_CACHE_TTL_SECONDS)).replace(microsecond=0).isoformat()


def read_genre_cache(genre_id: str) -> dict[str, Any] | None:
    path = _genre_json_path(genre_id)
    if not path.is_file():
        return None
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (json.JSONDecodeError, OSError):
        return None


def write_genre_cache(payload: dict[str, Any]) -> dict[str, Any]:
    genre_id = payload.get("genre_id") or payload.get("genre", {}).get("id")
    if not genre_id:
        raise ValueError("genre_id required")
    path = _genre_json_path(str(genre_id))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    return payload


def is_cache_stale(payload: dict[str, Any] | None) -> bool:
    if not payload or not payload.get("works"):
        return True
    updated_at = payload.get("updated_at")
    if not updated_at:
        return True
    try:
        updated = datetime.fromisoformat(str(updated_at).replace("Z", "+00:00"))
        if updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
    except ValueError:
        return True
    return (datetime.now(timezone.utc) - updated).total_seconds() >= ART_CACHE_TTL_SECONDS


def _genre_meta(genre_id: str) -> dict[str, str]:
    genre = next((g for g in GENRES if g["id"] == genre_id), None)
    if not genre:
        raise ValueError(f"Unknown genre: {genre_id}")
    return genre


def _search_met_works_random(query: str, limit: int = 20) -> list[dict[str, Any]]:
    ids, _ = _met_search(query, artist=False, max_ids=max(limit * 8, 80))
    if not ids:
        return []
    pool = list(ids)
    random.shuffle(pool)
    works = _fetch_met_works_from_ids(pool, limit=limit)
    return _apply_korean_descriptions(works)


def _ext_for_content_type(content_type: str) -> str:
    lowered = (content_type or "").lower()
    if "png" in lowered:
        return "png"
    if "webp" in lowered:
        return "webp"
    return "jpg"


def _download_one_image(
    genre_id: str,
    object_id: int | str,
    kind: str,
    url: str,
) -> tuple[str, str, bool]:
    if not url or not url.startswith("http"):
        return kind, "", False
    try:
        data, content_type = _fetch_bytes(url, max_bytes=2_500_000)
    except Exception:
        return kind, "", False
    ext = _ext_for_content_type(content_type)
    path = _image_path_for_write(genre_id, object_id, kind, ext)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return kind, work_image_api_path(genre_id, object_id, kind), True


def _cache_work_images(genre_id: str, work: dict[str, Any]) -> dict[str, Any]:
    object_id = work.get("id")
    if not object_id:
        return work

    tasks: list[tuple[str, str]] = []
    for kind in IMAGE_KINDS:
        direct_key = f"direct_{kind}_url"
        plain_key = f"{kind}_url"
        url = (work.get(direct_key) or work.get(plain_key) or "").strip()
        if url.startswith("http"):
            tasks.append((kind, url))

    if not tasks:
        return work

    cached: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [
            pool.submit(_download_one_image, genre_id, object_id, kind, url)
            for kind, url in tasks
        ]
        for future in as_completed(futures):
            kind, api_path, ok = future.result()
            if ok and api_path:
                cached[kind] = api_path

    for kind in IMAGE_KINDS:
        if kind not in cached:
            continue
        work[f"{kind}_url"] = cached[kind]
        work[f"direct_{kind}_url"] = cached[kind]
    return work


def _clear_genre_images(genre_id: str) -> None:
    img_dir = _image_dir(genre_id)
    if img_dir.is_dir():
        shutil.rmtree(img_dir, ignore_errors=True)


def refresh_genre_cache(
    genre_id: str,
    *,
    limit: int = 20,
    trigger: str = "manual",
) -> dict[str, Any]:
    genre = _genre_meta(genre_id)
    works = _search_met_works_random(genre["search"], limit=limit)
    if not works:
        raise RuntimeError(f"No works found for genre {genre_id}")

    _clear_genre_images(genre_id)
    cached_works: list[dict[str, Any]] = []
    for work in works:
        cached_works.append(_cache_work_images(genre_id, dict(work)))

    updated_at = _now_iso()
    payload: dict[str, Any] = {
        "genre_id": genre_id,
        "genre": genre,
        "works": cached_works,
        "count": len(cached_works),
        "updated_at": updated_at,
        "next_refresh_at": _next_refresh_iso(updated_at),
        "trigger": trigger,
        "cached": True,
        "cache_ttl_hours": ART_CACHE_TTL_SECONDS / 3600,
    }
    return write_genre_cache(payload)


def refresh_all_genre_caches(*, trigger: str = "schedule") -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    for genre in GENRES:
        genre_id = genre["id"]
        try:
            payload = refresh_genre_cache(genre_id, trigger=trigger)
            results.append(
                {
                    "genre_id": genre_id,
                    "count": payload.get("count", 0),
                    "updated_at": payload.get("updated_at"),
                }
            )
        except Exception as exc:
            errors.append({"genre_id": genre_id, "error": str(exc)})
        time.sleep(0.35)
    return {
        "refreshed": len(results),
        "genres": results,
        "errors": errors,
        "trigger": trigger,
        "updated_at": _now_iso(),
    }


def get_genre_works_response(
    genre_id: str,
    *,
    limit: int = 20,
    force_refresh: bool = False,
    trigger: str = "read",
) -> dict[str, Any]:
    cached = read_genre_cache(genre_id)
    if force_refresh or not cached or not cached.get("works"):
        return refresh_genre_cache(genre_id, limit=limit, trigger=trigger if force_refresh else "bootstrap")

    genre = _genre_meta(genre_id)
    updated_at = cached.get("updated_at") or _now_iso()
    return {
        "genre": cached.get("genre") or genre,
        "works": cached.get("works") or [],
        "count": cached.get("count") or len(cached.get("works") or []),
        "updated_at": updated_at,
        "next_refresh_at": cached.get("next_refresh_at") or _next_refresh_iso(updated_at),
        "trigger": cached.get("trigger") or trigger,
        "cached": True,
        "stale": is_cache_stale(cached),
        "cache_ttl_hours": ART_CACHE_TTL_SECONDS / 3600,
    }


def load_work_image(genre_id: str, object_id: int, kind: str) -> tuple[bytes, str]:
    if kind not in IMAGE_KINDS:
        raise ValueError("Invalid image kind")
    _genre_meta(genre_id)
    path = _image_file(genre_id, object_id, kind)
    if not path:
        raise FileNotFoundError("Cached image not found")
    ext = path.suffix.lower()
    media = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(ext, "image/jpeg")
    return path.read_bytes(), media
