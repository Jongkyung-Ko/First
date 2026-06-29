"""Disk cache for ART genre galleries — refreshed every 2 hours or on demand."""

from __future__ import annotations

import hashlib
import json
import os
import random
import re
import shutil
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from art_service import (
    GENRES,
    _apply_korean_descriptions,
    _fetch_bytes,
    fetch_met_genre_works,
)

ART_CACHE_TTL_SECONDS = 2 * 3600
IMAGE_KINDS = ("thumb", "preview", "full")
PORTRAIT_WIDTHS = (120, 200, 320)
ART_BGM_QUERIES = ["Veaceslav Dragnov", "Veaceslav Draganov"]
ART_BGM_GENRES = ["classical", "jazz", "pop", "rock", "folkhiphop"]
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
    oid = urllib.parse.quote(str(object_id), safe="")
    return f"/api/art/work-image?genre={genre_id}&id={oid}&kind={kind}"


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


def _search_merged_genre_works(
    genre_id: str,
    limit: int = 20,
    *,
    fresh: bool = False,
) -> list[dict[str, Any]]:
    from art_service import merge_artwork_lists
    from artic_service import search_aic_genre_works

    met_count = max(1, limit // 2)
    aic_count = max(1, limit - met_count)
    met_works = fetch_met_genre_works(genre_id, limit=met_count, fresh=fresh)
    aic_works = _apply_korean_descriptions(
        search_aic_genre_works(genre_id, limit=aic_count, fresh=fresh)
    )
    return merge_artwork_lists(met_works, aic_works, limit=limit)


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

    if work.get("source") == "aic" and work.get("image_id"):
        from artic_service import AIC_IMAGE_SIZES, fetch_aic_image_bytes

        image_id = str(work["image_id"])
        cached: dict[str, str] = {}
        for kind, size in AIC_IMAGE_SIZES.items():
            try:
                data, content_type = fetch_aic_image_bytes(image_id, size)
                ext = _ext_for_content_type(content_type)
                path = _image_path_for_write(genre_id, object_id, kind, ext)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                cached[kind] = work_image_api_path(genre_id, object_id, kind)
            except Exception:
                continue
        for kind in IMAGE_KINDS:
            if kind in cached:
                work[f"{kind}_url"] = cached[kind]
                work[f"direct_{kind}_url"] = cached[kind]
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


def bootstrap_genre_cache(
    genre_id: str,
    *,
    limit: int = 20,
) -> dict[str, Any]:
    """Fast first paint — metadata + remote image URLs only (no disk download)."""
    genre = _genre_meta(genre_id)
    works = _search_merged_genre_works(genre_id, limit=limit)
    if not works:
        raise RuntimeError(f"No works found for genre {genre_id}")

    updated_at = _now_iso()
    payload: dict[str, Any] = {
        "genre_id": genre_id,
        "genre": genre,
        "works": works,
        "count": len(works),
        "updated_at": updated_at,
        "next_refresh_at": _next_refresh_iso(updated_at),
        "trigger": "bootstrap",
        "cached": True,
        "images_cached": False,
        "cache_ttl_hours": ART_CACHE_TTL_SECONDS / 3600,
    }
    write_genre_cache(payload)
    return payload


def _format_genre_response(cached: dict[str, Any], *, trigger: str = "read") -> dict[str, Any]:
    genre_id = str(cached.get("genre_id") or cached.get("genre", {}).get("id") or "")
    genre = cached.get("genre") or _genre_meta(genre_id)
    updated_at = cached.get("updated_at") or _now_iso()
    return {
        "genre": genre,
        "works": cached.get("works") or [],
        "count": cached.get("count") or len(cached.get("works") or []),
        "updated_at": updated_at,
        "next_refresh_at": cached.get("next_refresh_at") or _next_refresh_iso(updated_at),
        "trigger": cached.get("trigger") or trigger,
        "cached": True,
        "images_cached": bool(cached.get("images_cached", True)),
        "stale": is_cache_stale(cached),
        "cache_ttl_hours": ART_CACHE_TTL_SECONDS / 3600,
    }


def refresh_genre_cache(
    genre_id: str,
    *,
    limit: int = 20,
    trigger: str = "manual",
) -> dict[str, Any]:
    genre = _genre_meta(genre_id)
    works = _search_merged_genre_works(genre_id, limit=limit, fresh=True)
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
        "images_cached": True,
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

    portrait_result: dict[str, Any] = {}
    bgm_result: dict[str, Any] = {}
    try:
        portrait_result = warm_all_portraits()
    except Exception as exc:
        portrait_result = {"error": str(exc)}
    try:
        bgm_result = ensure_bgm_cached()
    except Exception as exc:
        bgm_result = {"error": str(exc)}

    return {
        "refreshed": len(results),
        "genres": results,
        "errors": errors,
        "portraits": portrait_result,
        "bgm": bgm_result if "error" not in bgm_result else bgm_result,
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
    if force_refresh:
        return refresh_genre_cache(genre_id, limit=limit, trigger=trigger if trigger != "read" else "manual")

    cached = read_genre_cache(genre_id)
    if cached and cached.get("works"):
        return _format_genre_response(cached, trigger=trigger)

    return bootstrap_genre_cache(genre_id, limit=limit)


def load_work_image(genre_id: str, object_id: str | int, kind: str) -> tuple[bytes, str]:
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


def _aic_image_dir() -> Path:
    return cache_root() / "aic-images"


def _aic_image_disk_file(image_id: str, size: int) -> Path | None:
    safe_id = re.sub(r"[^\w\-]", "_", str(image_id))[:120]
    base = _aic_image_dir() / f"{safe_id}_{size}"
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        path = base.with_suffix(ext)
        if path.is_file():
            return path
    return None


def load_aic_image_disk(image_id: str, size: int) -> tuple[bytes, str] | None:
    path = _aic_image_disk_file(image_id, size)
    if not path:
        return None
    ext = path.suffix.lower()
    media = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(ext, "image/jpeg")
    return path.read_bytes(), media


def save_aic_image_disk(image_id: str, size: int, data: bytes, content_type: str) -> Path:
    safe_id = re.sub(r"[^\w\-]", "_", str(image_id))[:120]
    ext = _ext_for_content_type(content_type)
    path = _aic_image_dir() / f"{safe_id}_{size}.{ext}"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path


def portrait_slug(name: str) -> str:
    slug = re.sub(r"[^\w\-]+", "-", (name or "").lower().strip())
    slug = re.sub(r"-+", "-", slug).strip("-")
    if len(slug) > 80:
        slug = slug[:80]
    if not slug:
        slug = hashlib.sha1((name or "").encode("utf-8")).hexdigest()[:16]
    return slug


def _portrait_dir() -> Path:
    return cache_root() / "portraits"


def _portrait_disk_file(name: str, width: int) -> Path | None:
    slug = portrait_slug(name)
    base = _portrait_dir() / f"{slug}_{width}"
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        path = base.with_suffix(ext)
        if path.is_file():
            return path
    return None


def load_portrait_disk(name: str, width: int) -> tuple[bytes, str] | None:
    path = _portrait_disk_file(name, width)
    if not path:
        return None
    ext = path.suffix.lower()
    media = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(ext, "image/jpeg")
    return path.read_bytes(), media


def save_portrait_disk(name: str, width: int, data: bytes, content_type: str) -> Path:
    ext = _ext_for_content_type(content_type)
    path = _portrait_dir() / f"{portrait_slug(name)}_{width}.{ext}"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path


def warm_all_portraits() -> dict[str, Any]:
    from art_service import ERAS, fetch_portrait_image

    names: set[str] = set()
    for era in ERAS:
        names.update(era.get("artists") or [])

    warmed = 0
    errors: list[dict[str, str]] = []
    for name in sorted(names):
        for width in PORTRAIT_WIDTHS:
            try:
                fetch_portrait_image(name, width=width)
                warmed += 1
            except Exception as exc:
                errors.append({"name": name, "width": str(width), "error": str(exc)})
        time.sleep(0.15)
    return {"warmed": warmed, "artists": len(names), "errors": errors}


def _bgm_dir() -> Path:
    return cache_root() / "bgm"


def _bgm_meta_path() -> Path:
    return _bgm_dir() / "track.json"


def _bgm_audio_file() -> Path | None:
    for name in ("audio.mp3", "audio.mpeg", "audio.ogg", "audio.webm"):
        path = _bgm_dir() / name
        if path.is_file():
            return path
    return None


def read_bgm_meta() -> dict[str, Any] | None:
    path = _bgm_meta_path()
    if not path.is_file():
        return None
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (json.JSONDecodeError, OSError):
        return None


def _pick_bgm_track(tracks: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not tracks:
        return None
    artist_match = next(
        (
            t
            for t in tracks
            if re.search(r"veaceslav", t.get("artist") or "", re.I)
            and re.search(r"dragn", t.get("artist") or "", re.I)
        ),
        None,
    )
    if artist_match:
        return artist_match
    drag_match = next((t for t in tracks if re.search(r"dragn", t.get("artist") or "", re.I)), None)
    return drag_match or tracks[0]


def ensure_bgm_cached() -> dict[str, Any]:
    audio_path = _bgm_audio_file()
    meta = read_bgm_meta()
    if audio_path and meta:
        return meta

    from music_service import fetch_stream_bytes, fetch_tracks, resolve_stream_for_id

    track: dict[str, Any] | None = None
    for query in ART_BGM_QUERIES:
        for genre in ART_BGM_GENRES:
            try:
                data = fetch_tracks(genre, page=1, limit=10, q=query)
            except Exception:
                continue
            track = _pick_bgm_track(data.get("tracks") or [])
            if track:
                break
        if track:
            break

    if not track or not track.get("id"):
        raise RuntimeError("ART BGM track not found")

    upstream = resolve_stream_for_id(str(track["id"]))
    audio_bytes, _, _, content_type, _, _ = fetch_stream_bytes(upstream, max_bytes=12_000_000)
    if not audio_bytes:
        raise RuntimeError("ART BGM download failed")

    ext = "mp3"
    lowered = (content_type or "").lower()
    if "ogg" in lowered:
        ext = "ogg"
    elif "webm" in lowered:
        ext = "webm"
    elif "mpeg" in lowered or "mp3" in lowered:
        ext = "mp3"

    bgm_dir = _bgm_dir()
    bgm_dir.mkdir(parents=True, exist_ok=True)
    for old in bgm_dir.glob("audio.*"):
        if old.is_file():
            old.unlink(missing_ok=True)

    out_path = bgm_dir / f"audio.{ext}"
    out_path.write_bytes(audio_bytes)

    payload: dict[str, Any] = {
        "track_id": track.get("id"),
        "title": track.get("title") or "",
        "artist": track.get("artist") or "",
        "stream_path": "/api/art/bgm",
        "content_type": content_type or "audio/mpeg",
        "file": out_path.name,
        "updated_at": _now_iso(),
    }
    with _bgm_meta_path().open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    return payload


def load_bgm_audio() -> tuple[bytes, str]:
    if not _bgm_audio_file():
        ensure_bgm_cached()
    audio_path = _bgm_audio_file()
    if not audio_path:
        raise FileNotFoundError("ART BGM audio not cached")
    meta = read_bgm_meta() or {}
    content_type = str(meta.get("content_type") or "audio/mpeg")
    return audio_path.read_bytes(), content_type
