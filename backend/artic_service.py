"""Art Institute of Chicago (artic.edu) open API integration."""

from __future__ import annotations

import json
import random
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from art_service import (
    _artist_search_name,
    _fetch_bytes,
    _object_matches_artist,
    _secondary_artist_markers,
)

AIC_API = "https://api.artic.edu/api/v1"
AIC_UA = "DigitalWorld-ART/1.0 (educational; github.com/Jongkyung-Ko/First)"

ARTWORK_FIELDS = (
    "id,title,artist_display,image_id,date_display,medium_display,"
    "dimensions,artwork_type_title,thumbnail,is_public_domain"
)

AIC_IMAGE_SIZES = {
    "thumb": 400,
    "preview": 843,
    "full": 1686,
}

_CACHE: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 3600


def _cache_get(key: str) -> Any | None:
    entry = _CACHE.get(key)
    if not entry:
        return None
    expires, value = entry
    if time.time() > expires:
        _CACHE.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: Any) -> Any:
    _CACHE[key] = (time.time() + _CACHE_TTL, value)
    return value


def _aic_request(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"{AIC_API}{path}"
    if params:
        clean = {k: v for k, v in params.items() if v is not None and v != ""}
        if clean:
            url = f"{url}?{urllib.parse.urlencode(clean)}"
    req = urllib.request.Request(url, headers={"User-Agent": AIC_UA})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode("utf-8"))


def aic_image_api_path(image_id: str, size: int = 843) -> str:
    return (
        f"/api/art/aic-image?iid={urllib.parse.quote(str(image_id), safe='')}"
        f"&size={max(200, min(int(size), 2000))}"
    )


def _iiif_url(image_id: str, size: int) -> str:
    return f"https://www.artic.edu/iiif/2/{image_id}/full/!{size},/0/default.jpg"


def fetch_aic_image_bytes(image_id: str, size: int = 843) -> tuple[bytes, str]:
    from art_cache import load_aic_image_disk, save_aic_image_disk

    size = max(200, min(int(size), 2000))
    disk = load_aic_image_disk(image_id, size)
    if disk:
        return disk

    url = _iiif_url(image_id, size)
    data, content_type = _fetch_bytes(
        url,
        headers={"User-Agent": AIC_UA, "Referer": "https://www.artic.edu/"},
        max_bytes=3_500_000,
    )
    save_aic_image_disk(image_id, size, data, content_type)
    return data, content_type


def _normalize_artist_title(title: str) -> str:
    return re.sub(r"\s+", " ", (title or "").lower().strip())


def _pick_aic_artist_row(rows: list[dict[str, Any]], canonical: str, search: str) -> dict[str, Any] | None:
    if not rows:
        return None
    targets = {_normalize_artist_title(canonical), _normalize_artist_title(search)}
    targets.discard("")

    exact: list[dict[str, Any]] = []
    partial: list[dict[str, Any]] = []
    for row in rows:
        title = str(row.get("title") or "")
        norm = _normalize_artist_title(title)
        if _secondary_artist_markers(title):
            continue
        if norm in targets:
            exact.append(row)
            continue
        if any(t in norm for t in targets if t):
            partial.append(row)
    if exact:
        return exact[0]
    if partial:
        return partial[0]
    for row in rows:
        title = str(row.get("title") or "")
        if not _secondary_artist_markers(title):
            return row
    return rows[0]


def resolve_aic_artist_id(canonical_name: str, search_name: str) -> int | None:
    cache_key = f"aic-artist-id:{canonical_name.lower()}:{search_name.lower()}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached or None

    artist_id: int | None = None
    for query in (canonical_name, search_name):
        if not query:
            continue
        try:
            payload = _aic_request(
                "/artists/search",
                {"q": query, "fields": "id,title", "limit": "12"},
            )
        except urllib.error.HTTPError:
            continue
        row = _pick_aic_artist_row(payload.get("data") or [], canonical_name, search_name)
        if row and row.get("id"):
            artist_id = int(row["id"])
            break

    _cache_set(cache_key, artist_id or 0)
    return artist_id


def _aic_description(row: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in ("artwork_type_title", "medium_display", "dimensions", "date_display"):
        val = row.get(key)
        if val and str(val).strip():
            parts.append(str(val).strip())
    if not parts:
        return "Art Institute of Chicago · 공개 컬렉션"
    return " · ".join(parts)


def _normalize_aic_artwork(row: dict[str, Any]) -> dict[str, Any] | None:
    image_id = row.get("image_id")
    if not image_id:
        return None
    if row.get("is_public_domain") is False:
        return None

    artwork_id = row.get("id")
    artist_display = str(row.get("artist_display") or "").strip()
    artist_line = artist_display.split("\n")[0].strip() if artist_display else "Unknown Artist"
    thumb = row.get("thumbnail") if isinstance(row.get("thumbnail"), dict) else {}
    lqip = str(thumb.get("lqip") or "") if thumb else ""

    preview = aic_image_api_path(str(image_id), AIC_IMAGE_SIZES["preview"])
    thumb_url = aic_image_api_path(str(image_id), AIC_IMAGE_SIZES["thumb"])
    full = aic_image_api_path(str(image_id), AIC_IMAGE_SIZES["full"])

    return {
        "id": f"aic:{artwork_id}",
        "source": "aic",
        "image_id": str(image_id),
        "title": row.get("title") or "Untitled",
        "artist": artist_line,
        "date": str(row.get("date_display") or ""),
        "description": _aic_description(row),
        "lqip": lqip,
        "preview_url": preview,
        "thumb_url": thumb_url,
        "image_url": full,
        "direct_preview_url": preview,
        "direct_thumb_url": thumb_url,
        "direct_image_url": full,
        "collection_url": f"https://www.artic.edu/artworks/{artwork_id}",
        "met_url": f"https://www.artic.edu/artworks/{artwork_id}",
    }


def _is_aic_painting(row: dict[str, Any]) -> bool:
    kind = str(row.get("artwork_type_title") or "").lower()
    return "painting" in kind or kind in ("oil on canvas", "watercolor")


def _fetch_aic_artwork_pages(
    params: dict[str, Any],
    *,
    limit: int,
    artist_name: str | None = None,
    artist_search: str | None = None,
    paintings_only: bool = True,
) -> list[dict[str, Any]]:
    works: list[dict[str, Any]] = []
    seen: set[str] = set()
    page = 1
    while len(works) < limit and page <= 6:
        page_params = dict(params)
        page_params["limit"] = str(min(50, limit * 3))
        page_params["page"] = str(page)
        page_params["fields"] = ARTWORK_FIELDS
        try:
            payload = _aic_request("/artworks/search", page_params)
        except urllib.error.HTTPError:
            break
        rows = payload.get("data") or []
        if not rows:
            break
        for row in rows:
            if len(works) >= limit:
                break
            if paintings_only and not _is_aic_painting(row):
                continue
            if artist_name:
                display = str(row.get("artist_display") or "")
                if not _object_matches_artist(display, artist_name, artist_search or ""):
                    continue
            work = _normalize_aic_artwork(row)
            if not work:
                continue
            key = str(work["id"])
            if key in seen:
                continue
            seen.add(key)
            works.append(work)
        pagination = payload.get("pagination") or {}
        if page >= int(pagination.get("total_pages") or 1):
            break
        page += 1
    return works


def fetch_aic_artist_works(
    canonical_name: str,
    search_name: str | None = None,
    *,
    limit: int = 30,
    paintings_only: bool = True,
) -> list[dict[str, Any]]:
    search = search_name or _artist_search_name(canonical_name)
    cache_key = f"aic-artist-works:v1:{canonical_name.lower()}:n={limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    artist_id = resolve_aic_artist_id(canonical_name, search)
    if not artist_id:
        return _cache_set(cache_key, [])

    params: dict[str, Any] = {
        "query[term][artist_id]": str(artist_id),
        "sort[score]": "desc",
    }
    works = _fetch_aic_artwork_pages(
        params,
        limit=limit,
        artist_name=canonical_name,
        artist_search=search,
        paintings_only=paintings_only,
    )
    return _cache_set(cache_key, works)


def search_aic_genre_works(query: str, *, limit: int = 10) -> list[dict[str, Any]]:
    cache_key = f"aic-genre-works:v1:{query.lower()}:n={limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return list(cached)

    params: dict[str, Any] = {
        "q": query,
        "query[term][artwork_type_title]": "Painting",
        "query[term][is_public_domain]": "true",
        "sort[score]": "desc",
    }
    pool = _fetch_aic_artwork_pages(params, limit=max(limit * 3, 30), paintings_only=True)
    random.shuffle(pool)
    works = pool[:limit]
    return _cache_set(cache_key, works)
