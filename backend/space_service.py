"""NASA Open APIs — APOD and Image Library for Space page."""

from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

SPACE_UA = "DigitalWorld-Space/1.0 (educational; github.com/Jongkyung-Ko/First)"
NASA_API = "https://api.nasa.gov"
NASA_IMAGES = "https://images-api.nasa.gov"
KST = ZoneInfo("Asia/Seoul")
CACHE_TTL_APOD = 1800
CACHE_TTL_PLANET = 3600

_CACHE: dict[str, tuple[float, Any]] = {}

PLANETS: list[dict[str, Any]] = [
    {"id": "sun", "label": "태양", "label_en": "Sun", "emoji": "☀️", "accent": "#fbbf24", "query": "Sun solar corona NASA"},
    {"id": "mercury", "label": "수성", "label_en": "Mercury", "emoji": "☿", "accent": "#94a3b8", "query": "Mercury planet NASA"},
    {"id": "venus", "label": "금성", "label_en": "Venus", "emoji": "♀", "accent": "#fcd34d", "query": "Venus planet NASA"},
    {"id": "earth", "label": "지구", "label_en": "Earth", "emoji": "🌍", "accent": "#60a5fa", "query": "Earth planet from space NASA"},
    {"id": "mars", "label": "화성", "label_en": "Mars", "emoji": "♂", "accent": "#f87171", "query": "Mars planet NASA"},
    {"id": "jupiter", "label": "목성", "label_en": "Jupiter", "emoji": "♃", "accent": "#fdba74", "query": "Jupiter planet NASA"},
    {"id": "saturn", "label": "토성", "label_en": "Saturn", "emoji": "♄", "accent": "#fde68a", "query": "Saturn planet rings NASA"},
    {"id": "uranus", "label": "천왕성", "label_en": "Uranus", "emoji": "♅", "accent": "#7dd3fc", "query": "Uranus planet NASA"},
    {"id": "neptune", "label": "해왕성", "label_en": "Neptune", "emoji": "♆", "accent": "#818cf8", "query": "Neptune planet NASA"},
    {"id": "pluto", "label": "명왕성", "label_en": "Pluto", "emoji": "♇", "accent": "#cbd5e1", "query": "Pluto dwarf planet NASA"},
]

_PLANET_BY_ID = {p["id"]: p for p in PLANETS}


def _api_key() -> str:
    key = (os.environ.get("NASA_API_KEY") or os.environ.get("NASA_KEY") or "").strip()
    if not key:
        raise ValueError("NASA_API_KEY 환경변수가 설정되지 않았습니다.")
    return key


def _fetch_json(url: str, *, timeout: int = 30) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": SPACE_UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def _cache_get(key: str, ttl: int) -> Any | None:
    row = _CACHE.get(key)
    if row and time.time() - row[0] < ttl:
        return row[1]
    return None


def _cache_set(key: str, value: Any) -> None:
    _CACHE[key] = (time.time(), value)


def _pick_image_link(links: list[dict[str, Any]]) -> str:
    for link in links or []:
        href = str(link.get("href") or "")
        render = str(link.get("render") or "").lower()
        if href and ("image" in render or href.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp"))):
            return href
    for link in links or []:
        href = str(link.get("href") or "")
        if href:
            return href
    return ""


def _normalize_apod(row: dict[str, Any]) -> dict[str, Any]:
    media = str(row.get("media_type") or "image").lower()
    url = str(row.get("url") or "")
    hd = str(row.get("hdurl") or "")
    thumb = hd if media == "image" and hd else url
    return {
        "date": str(row.get("date") or ""),
        "title": str(row.get("title") or "Untitled"),
        "explanation": str(row.get("explanation") or ""),
        "media_type": media,
        "url": url,
        "hdurl": hd or None,
        "thumbnail": thumb if media == "image" else None,
        "copyright": row.get("copyright"),
    }


def fetch_apod_gallery(*, count: int = 6) -> dict[str, Any]:
    count = max(1, min(count, 12))
    cache_key = f"apod:{count}"
    cached = _cache_get(cache_key, CACHE_TTL_APOD)
    if cached:
        return cached

    query = urllib.parse.urlencode({"api_key": _api_key(), "count": count, "thumbs": "true"})
    url = f"{NASA_API}/planetary/apod?{query}"
    data = _fetch_json(url)

    items: list[dict[str, Any]] = []
    if isinstance(data, list):
        for row in data:
            if isinstance(row, dict):
                items.append(_normalize_apod(row))
    elif isinstance(data, dict):
        items.append(_normalize_apod(data))

    payload = {
        "kind": "apod_gallery",
        "count": len(items),
        "items": [row for row in items if row.get("media_type") == "image" or row.get("url")],
        "source": "nasa_apod",
        "updated_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
    }
    _cache_set(cache_key, payload)
    return payload


def fetch_apod_by_date(date_str: str | None = None) -> dict[str, Any]:
    if date_str:
        cache_key = f"apod:date:{date_str}"
    else:
        cache_key = "apod:today"
    cached = _cache_get(cache_key, CACHE_TTL_APOD)
    if cached:
        return cached

    params: dict[str, str] = {"api_key": _api_key(), "thumbs": "true"}
    if date_str:
        params["date"] = date_str
    query = urllib.parse.urlencode(params)
    url = f"{NASA_API}/planetary/apod?{query}"
    data = _fetch_json(url)
    if not isinstance(data, dict):
        raise ValueError("APOD 응답 형식이 올바르지 않습니다.")

    payload = {
        "kind": "apod",
        "item": _normalize_apod(data),
        "source": "nasa_apod",
        "updated_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
    }
    _cache_set(cache_key, payload)
    return payload


def list_planets() -> dict[str, Any]:
    return {
        "kind": "planets",
        "count": len(PLANETS),
        "items": [
            {
                "id": p["id"],
                "label": p["label"],
                "label_en": p["label_en"],
                "emoji": p["emoji"],
                "accent": p["accent"],
            }
            for p in PLANETS
        ],
    }


def _search_nasa_images(query: str, *, limit: int = 8) -> list[dict[str, Any]]:
    params = urllib.parse.urlencode(
        {
            "q": query,
            "media_type": "image",
            "page_size": max(limit, 8),
        }
    )
    url = f"{NASA_IMAGES}/search?{params}"
    data = _fetch_json(url)
    items_raw = (data.get("collection") or {}).get("items") or []

    out: list[dict[str, Any]] = []
    for row in items_raw:
        if not isinstance(row, dict):
            continue
        meta_list = row.get("data") or []
        meta = meta_list[0] if meta_list else {}
        thumb = _pick_image_link(row.get("links") or [])
        if not thumb:
            continue
        out.append(
            {
                "title": str(meta.get("title") or "NASA Image"),
                "description": str(meta.get("description") or meta.get("secondary_creator") or "")[:480],
                "date": str(meta.get("date_created") or meta.get("center") or ""),
                "thumbnail": thumb,
                "nasa_id": str(meta.get("nasa_id") or ""),
            }
        )
        if len(out) >= limit:
            break
    return out


def fetch_planet_images(planet_id: str, *, limit: int = 8) -> dict[str, Any]:
    planet = _PLANET_BY_ID.get((planet_id or "").strip().lower())
    if not planet:
        raise ValueError(f"Unknown planet: {planet_id}")

    limit = max(1, min(limit, 12))
    cache_key = f"planet:{planet['id']}:{limit}"
    cached = _cache_get(cache_key, CACHE_TTL_PLANET)
    if cached:
        return cached

    images = _search_nasa_images(str(planet["query"]), limit=limit)
    payload = {
        "kind": "planet_images",
        "planet": {
            "id": planet["id"],
            "label": planet["label"],
            "label_en": planet["label_en"],
            "emoji": planet["emoji"],
            "accent": planet["accent"],
        },
        "count": len(images),
        "items": images,
        "source": "nasa_image_library",
        "updated_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
    }
    _cache_set(cache_key, payload)
    return payload


def fetch_planets_overview(*, per_planet: int = 1) -> dict[str, Any]:
    per_planet = max(1, min(per_planet, 3))
    cache_key = f"planets_overview:{per_planet}"
    cached = _cache_get(cache_key, CACHE_TTL_PLANET)
    if cached:
        return cached

    cards: list[dict[str, Any]] = []
    for planet in PLANETS:
        images = _search_nasa_images(str(planet["query"]), limit=per_planet)
        hero = images[0] if images else None
        cards.append(
            {
                "id": planet["id"],
                "label": planet["label"],
                "label_en": planet["label_en"],
                "emoji": planet["emoji"],
                "accent": planet["accent"],
                "hero": hero,
            }
        )

    payload = {
        "kind": "planets_overview",
        "count": len(cards),
        "items": cards,
        "source": "nasa_image_library",
        "updated_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
    }
    _cache_set(cache_key, payload)
    return payload
