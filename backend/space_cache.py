"""Disk cache for Space page — APOD + solar system images, refreshed every 4 hours."""

from __future__ import annotations

import json
import os
import random
import re
import shutil
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from space_service import (
    PLANETS,
    SPACE_UA,
    _apply_korean_planet_items,
    _collect_apod_items,
    _search_planet_images,
    fetch_apod_gallery,
    fetch_planet_images,
    fetch_planets_overview,
)

SPACE_CACHE_TTL_SECONDS = 4 * 3600
APOD_POOL_SIZE = 20
APOD_PAGE_SIZE = 20
PLANET_POOL_SIZE = 12
PLANET_PAGE_SIZE = 8
KST = timezone(timedelta(hours=9))


def cache_root() -> Path:
    custom = os.getenv("SPACE_CACHE_DIR", "").strip()
    if custom:
        return Path(custom)
    return Path(__file__).resolve().parent / "data" / "space-cache"


def _apod_json_path() -> Path:
    return cache_root() / "apod.json"


def _planets_json_path() -> Path:
    return cache_root() / "planets.json"


def _image_dir(kind: str) -> Path:
    return cache_root() / "images" / kind


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
    return (base + timedelta(seconds=SPACE_CACHE_TTL_SECONDS)).replace(microsecond=0).isoformat()


def _safe_id(raw: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9._-]", "_", str(raw or "").strip())
    return clean[:120] or "item"


def space_image_api_path(kind: str, image_id: str) -> str:
    return f"/api/space/image?kind={urllib.parse.quote(kind)}&id={urllib.parse.quote(image_id, safe='')}"


def _ext_for_content_type(content_type: str) -> str:
    lowered = (content_type or "").lower()
    if "png" in lowered:
        return "png"
    if "webp" in lowered:
        return "webp"
    if "gif" in lowered:
        return "gif"
    return "jpg"


def _fetch_bytes(url: str, *, timeout: int = 45, max_bytes: int = 3_500_000) -> tuple[bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": SPACE_UA, "Accept": "image/*,*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read(max_bytes)
        content_type = resp.headers.get("Content-Type", "image/jpeg")
    if not data:
        raise ValueError("Empty image response")
    return data, content_type


def _image_file(kind: str, image_id: str) -> Path | None:
    base = _image_dir(kind) / _safe_id(image_id)
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        path = base.with_suffix(ext)
        if path.is_file():
            return path
    return None


def _image_path_for_write(kind: str, image_id: str, ext: str) -> Path:
    return _image_dir(kind) / f"{_safe_id(image_id)}.{ext.lstrip('.')}"


def load_space_image(kind: str, image_id: str) -> tuple[bytes, str]:
    path = _image_file(kind, image_id)
    if not path:
        raise FileNotFoundError(f"Space image not found: {kind}/{image_id}")
    ext = path.suffix.lower()
    content_type = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(ext, "image/jpeg")
    return path.read_bytes(), content_type


def _read_json(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def _write_json(path: Path, payload: dict[str, Any]) -> dict[str, Any]:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


def is_cache_stale(payload: dict[str, Any] | None) -> bool:
    if not payload:
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
    return (datetime.now(timezone.utc) - updated).total_seconds() >= SPACE_CACHE_TTL_SECONDS


def _clear_images(kind: str) -> None:
    img_dir = _image_dir(kind)
    if img_dir.is_dir():
        shutil.rmtree(img_dir, ignore_errors=True)


def _download_image(kind: str, image_id: str, url: str) -> str | None:
    if not url or not str(url).startswith("http"):
        return None
    try:
        data, content_type = _fetch_bytes(url)
    except Exception:
        return None
    ext = _ext_for_content_type(content_type)
    path = _image_path_for_write(kind, image_id, ext)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return space_image_api_path(kind, image_id)


def _cache_apod_item(item: dict[str, Any]) -> dict[str, Any]:
    row = dict(item)
    image_id = str(row.get("date") or row.get("title") or time.time())
    source_url = str(row.get("hdurl") or row.get("thumbnail") or row.get("url") or "").strip()
    local = _download_image("apod", image_id, source_url)
    if local:
        row["thumbnail"] = local
        row["hdurl"] = local
        row["url"] = local
        row["image_cached"] = True
    row["cache_id"] = _safe_id(image_id)
    return row


def _cache_planet_item(item: dict[str, Any], *, planet_id: str, index: int) -> dict[str, Any]:
    row = dict(item)
    image_id = str(row.get("nasa_id") or f"{planet_id}_{index}")
    source_url = str(row.get("thumbnail") or "").strip()
    local = _download_image("planet", image_id, source_url)
    if local:
        row["thumbnail"] = local
        row["image_cached"] = True
    row["cache_id"] = _safe_id(image_id)
    return row


def _fetch_fresh_apod_items() -> list[dict[str, Any]]:
    return _collect_apod_items(count=APOD_POOL_SIZE)


def _fetch_fresh_planet_items(planet: dict[str, Any]) -> list[dict[str, Any]]:
    skip = random.randint(0, 28)
    images, _ = _search_planet_images(planet, limit=PLANET_POOL_SIZE, skip=skip)
    return _apply_korean_planet_items(images)


def refresh_apod_cache(*, trigger: str = "manual") -> dict[str, Any]:
    items = _fetch_fresh_apod_items()
    _clear_images("apod")
    cached_items: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(_cache_apod_item, item) for item in items]
        for future in as_completed(futures):
            try:
                cached_items.append(future.result())
            except Exception:
                continue
    cached_items.sort(key=lambda row: str(row.get("date") or ""), reverse=True)
    updated_at = _now_iso()
    payload: dict[str, Any] = {
        "kind": "apod_gallery",
        "count": len(cached_items),
        "items": cached_items,
        "has_more": False,
        "source": "nasa_apod",
        "updated_at": updated_at,
        "next_refresh_at": _next_refresh_iso(updated_at),
        "trigger": trigger,
        "images_cached": any(row.get("image_cached") for row in cached_items),
        "cache_ttl_hours": SPACE_CACHE_TTL_SECONDS / 3600,
    }
    return _write_json(_apod_json_path(), payload)


def refresh_planets_cache(*, trigger: str = "manual") -> dict[str, Any]:
    _clear_images("planet")
    planet_payloads: dict[str, Any] = {}
    overview_cards: list[dict[str, Any]] = []

    def _refresh_one(planet: dict[str, Any]) -> tuple[str, dict[str, Any], dict[str, Any]]:
        images = _fetch_fresh_planet_items(planet)
        cached_items: list[dict[str, Any]] = []
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = [
                pool.submit(_cache_planet_item, item, planet_id=planet["id"], index=idx)
                for idx, item in enumerate(images)
            ]
            for future in as_completed(futures):
                try:
                    cached_items.append(future.result())
                except Exception:
                    continue
        hero = cached_items[0] if cached_items else None
        detail = {
            "kind": "planet_images",
            "planet": {
                "id": planet["id"],
                "label": planet["label"],
                "label_en": planet["label_en"],
                "emoji": planet["emoji"],
                "accent": planet["accent"],
            },
            "count": len(cached_items),
            "items": cached_items,
            "skip": 0,
            "has_more": len(cached_items) > PLANET_PAGE_SIZE,
            "source": "nasa_image_library",
            "images_cached": any(row.get("image_cached") for row in cached_items),
        }
        card = {
            "id": planet["id"],
            "label": planet["label"],
            "label_en": planet["label_en"],
            "emoji": planet["emoji"],
            "accent": planet["accent"],
            "hero": hero,
        }
        return planet["id"], detail, card

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(_refresh_one, planet) for planet in PLANETS]
        for future in as_completed(futures):
            planet_id, detail, card = future.result()
            planet_payloads[planet_id] = detail
            overview_cards.append(card)

    overview_cards.sort(key=lambda row: next((i for i, p in enumerate(PLANETS) if p["id"] == row["id"]), 99))
    updated_at = _now_iso()
    payload: dict[str, Any] = {
        "kind": "planets_bundle",
        "overview": {
            "kind": "planets_overview",
            "count": len(overview_cards),
            "items": overview_cards,
            "source": "nasa_image_library",
            "images_cached": any(card.get("hero") for card in overview_cards),
        },
        "planets": planet_payloads,
        "updated_at": updated_at,
        "next_refresh_at": _next_refresh_iso(updated_at),
        "trigger": trigger,
        "cache_ttl_hours": SPACE_CACHE_TTL_SECONDS / 3600,
    }
    return _write_json(_planets_json_path(), payload)


def refresh_space_cache(*, trigger: str = "manual", force: bool = False) -> dict[str, Any]:
    started = time.time()
    apod_cached = _read_json(_apod_json_path())
    planets_cached = _read_json(_planets_json_path())
    if not force and apod_cached and planets_cached and not is_cache_stale(apod_cached):
        return {
            "ok": True,
            "skipped": True,
            "updated_at": apod_cached.get("updated_at"),
            "next_refresh_at": apod_cached.get("next_refresh_at"),
            "elapsed_sec": round(time.time() - started, 2),
        }

    apod_result: dict[str, Any] = {}
    planets_result: dict[str, Any] = {}
    errors: list[str] = []
    try:
        apod_result = refresh_apod_cache(trigger=trigger)
    except Exception as exc:
        errors.append(f"apod: {exc}")
    try:
        planets_result = refresh_planets_cache(trigger=trigger)
    except Exception as exc:
        errors.append(f"planets: {exc}")

    return {
        "ok": not errors,
        "errors": errors,
        "apod": {
            "count": apod_result.get("count", 0),
            "images_cached": apod_result.get("images_cached"),
            "updated_at": apod_result.get("updated_at"),
        },
        "planets": {
            "count": planets_result.get("overview", {}).get("count", 0),
            "updated_at": planets_result.get("updated_at"),
        },
        "updated_at": apod_result.get("updated_at") or planets_result.get("updated_at"),
        "next_refresh_at": apod_result.get("next_refresh_at") or planets_result.get("next_refresh_at"),
        "elapsed_sec": round(time.time() - started, 2),
        "trigger": trigger,
    }


def _ensure_apod_cache() -> dict[str, Any] | None:
    cached = _read_json(_apod_json_path())
    if cached and cached.get("items") and not is_cache_stale(cached):
        return cached
    try:
        return refresh_apod_cache(trigger="on_demand")
    except Exception:
        return cached


def _ensure_planets_cache() -> dict[str, Any] | None:
    cached = _read_json(_planets_json_path())
    if cached and cached.get("planets") and not is_cache_stale(cached):
        return cached
    try:
        return refresh_planets_cache(trigger="on_demand")
    except Exception:
        return cached


def get_cached_apod_gallery(
    *,
    count: int = APOD_PAGE_SIZE,
    exclude_dates: list[str] | None = None,
    refresh: bool = False,
) -> dict[str, Any]:
    if refresh and not exclude_dates:
        payload = refresh_apod_cache(trigger="refresh")
        items = list(payload.get("items") or [])
        picked = items[: max(1, min(count, APOD_POOL_SIZE))]
        return {
            "kind": "apod_gallery",
            "count": len(picked),
            "items": picked,
            "has_more": False,
            "source": "nasa_apod",
            "cached": True,
            "refreshed": True,
            "images_cached": bool(payload.get("images_cached")),
            "updated_at": payload.get("updated_at"),
            "next_refresh_at": payload.get("next_refresh_at"),
        }
    cached = _ensure_apod_cache()
    if cached and cached.get("items"):
        items = list(cached["items"])
        if exclude_dates:
            exclude = {d.strip() for d in exclude_dates if d.strip()}
            items = [item for item in items if str(item.get("date") or "") not in exclude]
        picked = items[: max(1, min(count, APOD_POOL_SIZE))]
        return {
            "kind": "apod_gallery",
            "count": len(picked),
            "items": picked,
            "has_more": False,
            "source": "nasa_apod",
            "cached": True,
            "images_cached": bool(cached.get("images_cached")),
            "updated_at": cached.get("updated_at"),
            "next_refresh_at": cached.get("next_refresh_at"),
        }
    return fetch_apod_gallery(count=count, exclude_dates=exclude_dates)


def get_cached_planets_overview(*, per_planet: int = 1) -> dict[str, Any]:
    cached = _ensure_planets_cache()
    if cached and cached.get("overview"):
        overview = dict(cached["overview"])
        overview["cached"] = True
        overview["updated_at"] = cached.get("updated_at")
        overview["next_refresh_at"] = cached.get("next_refresh_at")
        return overview
    return fetch_planets_overview(per_planet=per_planet)


def get_cached_planet_images(planet_id: str, *, limit: int = PLANET_PAGE_SIZE, skip: int = 0) -> dict[str, Any]:
    key = (planet_id or "").strip().lower()
    cached = _ensure_planets_cache()
    detail = (cached or {}).get("planets", {}).get(key) if cached else None
    if detail and detail.get("items"):
        items = list(detail["items"])
        sliced = items[skip : skip + max(1, min(limit, PLANET_POOL_SIZE))]
        return {
            "kind": "planet_images",
            "planet": detail.get("planet") or {},
            "count": len(sliced),
            "items": sliced,
            "skip": skip,
            "has_more": len(items) > skip + len(sliced),
            "source": "nasa_image_library",
            "cached": True,
            "images_cached": bool(detail.get("images_cached")),
            "updated_at": cached.get("updated_at"),
            "next_refresh_at": cached.get("next_refresh_at"),
        }
    return fetch_planet_images(planet_id, limit=limit, skip=skip)
