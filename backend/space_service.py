"""NASA Open APIs — APOD and Image Library for Space page."""

from __future__ import annotations

import json
import os
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

try:
    from deep_translator import GoogleTranslator
except ImportError:
    GoogleTranslator = None  # type: ignore[misc, assignment]

SPACE_UA = "DigitalWorld-Space/1.0 (educational; github.com/Jongkyung-Ko/First)"
NASA_API = "https://api.nasa.gov"
NASA_IMAGES = "https://images-api.nasa.gov"
KST = ZoneInfo("Asia/Seoul")
CACHE_TTL_APOD = 1800
CACHE_TTL_PLANET = 3600

_CACHE: dict[str, tuple[float, Any]] = {}
_KO_CACHE: dict[str, str] = {}

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


def _is_mostly_korean(text: str) -> bool:
    letters = [ch for ch in text if ch.isalpha()]
    if not letters:
        return False
    hangul = sum(1 for ch in letters if "\uac00" <= ch <= "\ud7a3")
    return hangul / len(letters) >= 0.35


def _translate_ko(text: str) -> str:
    clean = (text or "").strip()
    if not clean or _is_mostly_korean(clean):
        return clean
    cached = _KO_CACHE.get(clean)
    if cached is not None:
        return cached
    if GoogleTranslator is None:
        return clean
    try:
        payload = clean[:4500]
        translated = GoogleTranslator(source="auto", target="ko").translate(payload)
        result = (translated or clean).strip()
    except Exception:
        result = clean
    _KO_CACHE[clean] = result
    return result


def _apply_korean_apod(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not items:
        return items
    pending: set[str] = set()
    for item in items:
        for field in ("title", "explanation"):
            val = str(item.get(field) or "").strip()
            if val and not _is_mostly_korean(val):
                pending.add(val)
    if not pending:
        return items

    translated: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(_translate_ko, text): text for text in pending}
        for future in as_completed(futures):
            original = futures[future]
            try:
                translated[original] = future.result()
            except Exception:
                translated[original] = original

    for item in items:
        title = str(item.get("title") or "").strip()
        if title and title in translated:
            item["title_en"] = title
            item["title"] = translated[title]
        expl = str(item.get("explanation") or "").strip()
        if expl and expl in translated:
            item["explanation_en"] = expl
            item["explanation"] = translated[expl]
    return items


def _apply_korean_planet_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not items:
        return items
    pending: set[str] = set()
    for item in items:
        for field in ("title", "description"):
            val = str(item.get(field) or "").strip()
            if val and not _is_mostly_korean(val):
                pending.add(val)
    if not pending:
        return items

    translated: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(_translate_ko, text): text for text in pending}
        for future in as_completed(futures):
            original = futures[future]
            try:
                translated[original] = future.result()
            except Exception:
                translated[original] = original

    for item in items:
        title = str(item.get("title") or "").strip()
        if title and title in translated:
            item["title_en"] = title
            item["title"] = translated[title]
        desc = str(item.get("description") or "").strip()
        if desc and desc in translated:
            item["description_en"] = desc
            item["description"] = translated[desc]
    return items


def _youtube_embed(url: str) -> str | None:
    match = re.search(
        r"(?:youtube\.com/(?:embed/|watch\?v=|v/)|youtu\.be/)([\w-]{6,})",
        url or "",
        re.I,
    )
    if not match:
        return None
    return f"https://www.youtube.com/embed/{match.group(1)}"


def _fetch_apod_raw(*, count: int) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({"api_key": _api_key(), "count": count, "thumbs": "true"})
    url = f"{NASA_API}/planetary/apod?{query}"
    data = _fetch_json(url)
    rows: list[dict[str, Any]] = []
    if isinstance(data, list):
        for row in data:
            if isinstance(row, dict):
                rows.append(row)
    elif isinstance(data, dict):
        rows.append(data)
    return rows


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
    thumb = str(row.get("thumbnail_url") or "")
    if media == "image":
        thumb = hd or thumb or url
    embed = _youtube_embed(url) if media == "video" else None
    return {
        "date": str(row.get("date") or ""),
        "title": str(row.get("title") or "Untitled"),
        "explanation": str(row.get("explanation") or ""),
        "media_type": media,
        "url": url,
        "hdurl": hd or None,
        "thumbnail": thumb if media == "image" else None,
        "embed_url": embed,
        "copyright": row.get("copyright"),
    }


def _collect_apod_items(*, count: int, exclude_dates: set[str] | None = None) -> list[dict[str, Any]]:
    exclude = set(exclude_dates or [])
    collected: list[dict[str, Any]] = []
    seen = set(exclude)
    attempts = 0
    while len(collected) < count and attempts < 8:
        batch_size = min(max(count - len(collected) + len(seen), count), 12)
        for row in _fetch_apod_raw(count=batch_size):
            item = _normalize_apod(row)
            date_key = str(item.get("date") or "")
            if not date_key or date_key in seen:
                continue
            if item.get("media_type") != "image" and not item.get("url"):
                continue
            seen.add(date_key)
            collected.append(item)
            if len(collected) >= count:
                break
        attempts += 1
    return _apply_korean_apod(collected[:count])


def fetch_apod_gallery(*, count: int = 6, exclude_dates: list[str] | None = None) -> dict[str, Any]:
    count = max(1, min(count, 12))
    exclude = {d.strip() for d in (exclude_dates or []) if d.strip()}
    if exclude:
        items = _collect_apod_items(count=count, exclude_dates=exclude)
        return {
            "kind": "apod_gallery",
            "count": len(items),
            "items": items,
            "has_more": len(items) >= count,
            "source": "nasa_apod",
            "updated_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        }

    cache_key = f"apod:{count}"
    cached = _cache_get(cache_key, CACHE_TTL_APOD)
    if cached:
        return cached

    items = _collect_apod_items(count=count)
    payload = {
        "kind": "apod_gallery",
        "count": len(items),
        "items": items,
        "has_more": True,
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

    item = _normalize_apod(data)
    item = _apply_korean_apod([item])[0]
    payload = {
        "kind": "apod",
        "item": item,
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


def _search_nasa_images(query: str, *, limit: int = 8, skip: int = 0) -> tuple[list[dict[str, Any]], bool]:
    skip = max(0, skip)
    limit = max(1, limit)
    page_size = 25
    collected: list[dict[str, Any]] = []
    total_hits: int | None = None
    page = 1
    max_pages = 8

    while len(collected) < skip + limit and page <= max_pages:
        params = urllib.parse.urlencode(
            {
                "q": query,
                "media_type": "image",
                "page_size": page_size,
                "page": page,
            }
        )
        url = f"{NASA_IMAGES}/search?{params}"
        data = _fetch_json(url)
        if total_hits is None:
            meta = (data.get("collection") or {}).get("metadata") or {}
            try:
                total_hits = int(meta.get("total_hits") or 0)
            except (TypeError, ValueError):
                total_hits = 0
        items_raw = (data.get("collection") or {}).get("items") or []
        if not items_raw:
            break
        for row in items_raw:
            if not isinstance(row, dict):
                continue
            meta_list = row.get("data") or []
            meta = meta_list[0] if meta_list else {}
            thumb = _pick_image_link(row.get("links") or [])
            if not thumb:
                continue
            collected.append(
                {
                    "title": str(meta.get("title") or "NASA Image"),
                    "description": str(meta.get("description") or meta.get("secondary_creator") or "")[:480],
                    "date": str(meta.get("date_created") or meta.get("center") or ""),
                    "thumbnail": thumb,
                    "nasa_id": str(meta.get("nasa_id") or ""),
                }
            )
        page += 1

    sliced = collected[skip : skip + limit]
    has_more = False
    if total_hits is not None and total_hits > 0:
        has_more = skip + len(sliced) < total_hits
    else:
        has_more = len(collected) > skip + limit or len(sliced) >= limit
    return sliced, has_more


def fetch_planet_images(planet_id: str, *, limit: int = 8, skip: int = 0) -> dict[str, Any]:
    planet = _PLANET_BY_ID.get((planet_id or "").strip().lower())
    if not planet:
        raise ValueError(f"Unknown planet: {planet_id}")

    limit = max(1, min(limit, 12))
    skip = max(0, skip)
    cache_key = f"planet:{planet['id']}:{limit}:{skip}"
    cached = _cache_get(cache_key, CACHE_TTL_PLANET)
    if cached:
        return cached

    images, has_more = _search_nasa_images(str(planet["query"]), limit=limit, skip=skip)
    images = _apply_korean_planet_items(images)
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
        "skip": skip,
        "has_more": has_more,
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
        images, _ = _search_nasa_images(str(planet["query"]), limit=per_planet, skip=0)
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
