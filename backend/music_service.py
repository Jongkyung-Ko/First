"""Music catalog: Jamendo + Openverse + optional Musopen (commercial in-site streaming)."""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

JAMENDO_CLIENT_ID = os.getenv("JAMENDO_CLIENT_ID", "").strip()
MUSOPEN_API_KEY = os.getenv("MUSOPEN_API_KEY", "").strip()

OPENVERSE_API = "https://api.openverse.org/v1/audio/"
JAMENDO_API = "https://api.jamendo.com/v3.0/tracks/"
MUSOPEN_API = "https://musopen.org/api/v1/search/"

PAGE_SIZE_DEFAULT = 10
MIN_TRACK_MS = 45_000
_STREAM_CACHE_TTL = 3600
_stream_cache: dict[str, tuple[float, str]] = {}


def _cache_upstream(track_id: str, upstream_url: str) -> None:
    if track_id and upstream_url:
        _stream_cache[track_id] = (time.time() + _STREAM_CACHE_TTL, upstream_url)


def get_cached_stream_url(track_id: str) -> str | None:
    entry = _stream_cache.get(track_id)
    if not entry:
        return None
    expires, url = entry
    if time.time() > expires:
        _stream_cache.pop(track_id, None)
        return None
    return url

GENRES: list[dict[str, str]] = [
    {"id": "jazz", "label": "재즈", "jamendo_tag": "jazz", "openverse_q": "jazz"},
    {"id": "classical", "label": "클래식", "jamendo_tag": "classical", "openverse_q": "classical piano"},
    {"id": "pop", "label": "팝", "jamendo_tag": "pop", "openverse_q": "pop song"},
]

NC_LICENSE_RE = re.compile(r"nc", re.I)


def music_genres() -> list[dict[str, str]]:
    return [{"id": g["id"], "label": g["label"]} for g in GENRES]


def _genre_config(genre_id: str) -> dict[str, str]:
    for g in GENRES:
        if g["id"] == genre_id:
            return g
    raise ValueError(f"Unknown genre: {genre_id}")


def _http_json(url: str, headers: dict[str, str] | None = None, timeout: float = 25.0) -> Any:
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "DigitalWorld-Music/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def _license_commercial_stream_ok(license_slug: str, license_url: str = "") -> bool:
    slug = (license_slug or "").lower().replace("_", "-")
    combined = f"{slug} {license_url}".lower()
    if NC_LICENSE_RE.search(combined):
        return False
    if slug in ("cc0", "pdm", "pd", "publicdomain", "public-domain"):
        return True
    if slug.startswith("by"):
        return True
    if "creativecommons.org/publicdomain" in combined:
        return True
    if "creativecommons.org/licenses/by" in combined and "nc" not in combined:
        return True
    return False


def _normalize_license(slug: str, url: str = "") -> str:
    s = (slug or "unknown").lower()
    if url:
        return f"{s} ({url})"
    return s


def _track_key(track: dict[str, Any]) -> str:
    return f"{track.get('artist', '').lower()}|{track.get('title', '').lower()}"


def _serialize_track(
    *,
    source: str,
    track_id: str,
    title: str,
    artist: str,
    year: str | int | None,
    thumbnail: str,
    license_slug: str,
    license_url: str,
    attribution: str,
    duration_ms: int | None,
    instruments: list[str] | None = None,
    upstream_url: str,
) -> dict[str, Any] | None:
    if not upstream_url or not title:
        return None
    if not _license_commercial_stream_ok(license_slug, license_url):
        return None
    if duration_ms is not None and duration_ms < MIN_TRACK_MS:
        return None
    return {
        "id": f"{source}:{track_id}",
        "source": source,
        "source_id": str(track_id),
        "title": title,
        "artist": artist or "Unknown artist",
        "year": str(year) if year else "",
        "thumbnail": thumbnail or "",
        "license": license_slug,
        "license_label": license_slug.upper().replace("-", " ") if license_slug else "CC",
        "license_url": license_url,
        "attribution": attribution,
        "duration_ms": duration_ms or 0,
        "instruments": instruments or [],
        "stream_path": f"/api/music/stream/{source}/{urllib.parse.quote(str(track_id), safe='')}",
        "_upstream_url": upstream_url,
    }


def _fetch_jamendo(genre: dict[str, str], limit: int, offset: int) -> list[dict[str, Any]]:
    if not JAMENDO_CLIENT_ID:
        return []
    tag = genre["jamendo_tag"]
    params = {
        "client_id": JAMENDO_CLIENT_ID,
        "format": "json",
        "fuzzytags": tag,
        "limit": str(min(limit, 50)),
        "offset": str(offset),
        "include": "musicinfo",
        "audioformat": "mp32",
        "order": "popularity_total",
    }
    url = f"{JAMENDO_API}?{urllib.parse.urlencode(params)}"
    data = _http_json(url)
    results: list[dict[str, Any]] = []
    for row in data.get("results") or []:
        lic_url = str(row.get("license_ccurl") or "")
        lic_slug = lic_url.rstrip("/").split("/")[-1] if lic_url else "by"
        if "licenses" in lic_url:
            parts = lic_url.rstrip("/").split("/")
            if len(parts) >= 2:
                lic_slug = f"{parts[-2]}-{parts[-1]}" if parts[-2] in ("by", "by-sa", "by-nc", "by-nd", "by-nc-sa", "by-nc-nd") else parts[-1]
        released = row.get("releasedate") or ""
        year = released[:4] if released else ""
        musicinfo = row.get("musicinfo") or {}
        tags = musicinfo.get("tags") or {}
        instruments = []
        if isinstance(tags.get("instruments"), list):
            instruments = [str(t.get("name") or t) for t in tags["instruments"][:4]]
        track = _serialize_track(
            source="jamendo",
            track_id=str(row.get("id") or ""),
            title=str(row.get("name") or ""),
            artist=str(row.get("artist_name") or ""),
            year=year,
            thumbnail=str(row.get("album_image") or row.get("image") or ""),
            license_slug=lic_slug,
            license_url=lic_url,
            attribution=f"\"{row.get('name')}\" by {row.get('artist_name')} (Jamendo)",
            duration_ms=int(row.get("duration") or 0) * 1000,
            instruments=instruments,
            upstream_url=str(row.get("audio") or ""),
        )
        if track:
            results.append(track)
    return results


def _fetch_openverse(genre: dict[str, str], limit: int, page: int) -> list[dict[str, Any]]:
    q = genre["openverse_q"]
    params = {
        "q": q,
        "license_type": "commercial",
        "page_size": str(min(limit * 3, 30)),
        "page": str(page),
    }
    url = f"{OPENVERSE_API}?{urllib.parse.urlencode(params)}"
    data = _http_json(url)
    results: list[dict[str, Any]] = []
    for row in data.get("results") or []:
        provider = str(row.get("provider") or row.get("source") or "")
        duration_ms = int(row.get("duration") or 0)
        if duration_ms and duration_ms < MIN_TRACK_MS:
            continue
        if provider == "freesound" and duration_ms < 90_000:
            continue
        lic_slug = str(row.get("license") or "")
        lic_ver = str(row.get("license_version") or "")
        lic_slug_full = f"{lic_slug}-{lic_ver}" if lic_ver else lic_slug
        lic_url = str(row.get("license_url") or "")
        genres = row.get("genres") or []
        instruments: list[str] = []
        if isinstance(genres, list):
            instruments = [str(g) for g in genres[:4]]
        indexed = str(row.get("indexed_on") or "")
        year = indexed[:4] if indexed else ""
        thumb = str(row.get("thumbnail") or "")
        if thumb.startswith("/"):
            thumb = f"https://api.openverse.org{thumb}"
        track = _serialize_track(
            source="openverse",
            track_id=str(row.get("id") or ""),
            title=str(row.get("title") or ""),
            artist=str(row.get("creator") or ""),
            year=year,
            thumbnail=thumb,
            license_slug=lic_slug_full,
            license_url=lic_url,
            attribution=str(row.get("attribution") or ""),
            duration_ms=duration_ms,
            instruments=instruments,
            upstream_url=str(row.get("url") or ""),
        )
        if track:
            if provider == "jamendo" or duration_ms >= MIN_TRACK_MS:
                results.append(track)
    return results[:limit]


def _fetch_musopen(genre: dict[str, str], limit: int, offset: int) -> list[dict[str, Any]]:
    if not MUSOPEN_API_KEY or genre["id"] != "classical":
        return []
    composers = ["bach", "mozart", "beethoven", "chopin", "vivaldi"]
    idx = (offset // limit) % len(composers)
    composer = composers[idx]
    params = {
        "composer": composer,
        "license": "cc0",
        "format": "json",
        "api_key": MUSOPEN_API_KEY,
    }
    url = f"{MUSOPEN_API}?{urllib.parse.urlencode(params)}"
    try:
        data = _http_json(url)
    except urllib.error.HTTPError:
        return []
    results: list[dict[str, Any]] = []
    recordings = data.get("recordings") or data.get("results") or []
    if isinstance(data, list):
        recordings = data
    for row in recordings[:limit]:
        if not isinstance(row, dict):
            continue
        title = str(row.get("title") or row.get("name") or "")
        artist = str(row.get("performer") or row.get("composer") or row.get("artist") or "")
        year = row.get("year") or row.get("recording_date") or ""
        if isinstance(year, str) and len(year) >= 4:
            year = year[:4]
        inst = row.get("instrument") or row.get("instruments")
        instruments = [str(inst)] if inst and not isinstance(inst, list) else [str(i) for i in (inst or [])[:4]]
        upstream = str(row.get("url") or row.get("download_url") or row.get("recording_url") or "")
        track_id = str(row.get("id") or row.get("recording_id") or abs(hash(upstream)))
        track = _serialize_track(
            source="musopen",
            track_id=track_id,
            title=title,
            artist=artist,
            year=year,
            thumbnail=str(row.get("image") or row.get("thumbnail") or ""),
            license_slug="cc0",
            license_url="https://creativecommons.org/publicdomain/zero/1.0/",
            attribution=f"{title} — {artist} (Musopen, CC0)",
            duration_ms=int(row.get("duration") or 0) * 1000 if int(row.get("duration") or 0) < 10000 else int(row.get("duration") or 0),
            instruments=instruments,
            upstream_url=upstream,
        )
        if track:
            results.append(track)
    return results


def fetch_tracks(genre_id: str, page: int = 1, limit: int = PAGE_SIZE_DEFAULT) -> dict[str, Any]:
    genre = _genre_config(genre_id)
    page = max(1, page)
    limit = max(1, min(limit, 20))
    offset = (page - 1) * limit

    merged: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add_batch(batch: list[dict[str, Any]]) -> None:
        for t in batch:
            key = _track_key(t)
            if key in seen:
                continue
            seen.add(key)
            merged.append(t)

    add_batch(_fetch_jamendo(genre, limit * 2, offset))
    if genre_id == "classical":
        add_batch(_fetch_musopen(genre, limit, offset))
    add_batch(_fetch_openverse(genre, limit * 2, page))

    page_tracks = merged[:limit]
    for t in page_tracks:
        upstream = t.pop("_upstream_url", None)
        if upstream:
            _cache_upstream(t["id"], upstream)

    has_jamendo = bool(JAMENDO_CLIENT_ID)
    has_musopen = bool(MUSOPEN_API_KEY)
    sources_note = []
    if has_jamendo:
        sources_note.append("Jamendo")
    sources_note.append("Openverse")
    if has_musopen:
        sources_note.append("Musopen")

    est_total = max(len(merged), limit * page + (limit if len(merged) >= limit else 0))
    if page_tracks:
        est_total = max(est_total, offset + len(page_tracks) + (limit if len(merged) > limit else 0))

    return {
        "genre": genre_id,
        "page": page,
        "limit": limit,
        "tracks": page_tracks,
        "total_estimate": est_total,
        "has_more": len(merged) >= limit,
        "sources": sources_note,
        "api_status": {
            "jamendo": has_jamendo,
            "openverse": True,
            "musopen": has_musopen,
        },
    }


def resolve_stream_url(source: str, track_id: str) -> str:
    source = source.lower()
    if source == "jamendo":
        if not JAMENDO_CLIENT_ID:
            raise ValueError("Jamendo not configured")
        params = {
            "client_id": JAMENDO_CLIENT_ID,
            "format": "json",
            "id": track_id,
            "audioformat": "mp32",
        }
        url = f"{JAMENDO_API}?{urllib.parse.urlencode(params)}"
        data = _http_json(url)
        rows = data.get("results") or []
        if not rows:
            raise ValueError("Track not found")
        audio = str(rows[0].get("audio") or "")
        if not audio:
            raise ValueError("No stream URL")
        return audio
    if source == "openverse":
        detail_url = f"https://api.openverse.org/v1/audio/{urllib.parse.quote(track_id, safe='')}/"
        data = _http_json(detail_url)
        audio = str(data.get("url") or "")
        if not audio:
            raise ValueError("No stream URL")
        return audio
    if source == "musopen":
        cached = get_cached_stream_url(f"musopen:{track_id}")
        if cached:
            return cached
        raise ValueError("Musopen stream expired; reopen the track list")
    raise ValueError(f"Unknown source: {source}")


def resolve_stream_for_id(composite_id: str) -> str:
    if ":" in composite_id:
        source, track_id = composite_id.split(":", 1)
        return resolve_stream_url(source, track_id)
    cached = get_cached_stream_url(composite_id)
    if cached:
        return cached
    raise ValueError("Unknown track")


def fetch_stream_bytes(
    upstream_url: str,
    range_header: str | None = None,
    max_bytes: int = 12_000_000,
) -> tuple[bytes, int, int | None, str]:
    headers = {"User-Agent": "DigitalWorld-Music/1.0"}
    if range_header:
        headers["Range"] = range_header
    req = urllib.request.Request(upstream_url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        content_type = resp.headers.get("Content-Type", "audio/mpeg")
        status = resp.status
        content_range = resp.headers.get("Content-Range", "")
        total_size: int | None = None
        if content_range:
            m = re.search(r"/(\d+)$", content_range)
            if m:
                total_size = int(m.group(1))
        data = resp.read(max_bytes if not range_header else max_bytes)
        return data, status, total_size, content_type
