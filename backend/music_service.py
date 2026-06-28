"""Music catalog: Jamendo + Openverse (in-site streaming, NC included)."""

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

OPENVERSE_API = "https://api.openverse.org/v1/audio/"
JAMENDO_API = "https://api.jamendo.com/v3.0/tracks/"

PAGE_SIZE_DEFAULT = 10
MIN_TRACK_MS = 45_000
JAMENDO_BATCH_SIZE = 50
JAMENDO_MAX_SCAN = 500
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

GENRES: list[dict[str, Any]] = [
    {
        "id": "jazz",
        "label": "재즈",
        "theme": "스윙·비밥·재즈 피아노·트리오",
        "jamendo_tag": "jazz",
        "openverse_q": "jazz",
        "openverse_extra_q": "swing lounge",
        "subthemes": [
            {"id": "swing", "label": "스윙", "jamendo_tag": "swing", "openverse_q": "swing jazz"},
            {"id": "bebop", "label": "비밥", "jamendo_tag": "bebop", "openverse_q": "bebop jazz"},
            {"id": "piano", "label": "재즈 피아노", "jamendo_tag": "piano", "openverse_q": "jazz piano"},
            {"id": "trio", "label": "트리오", "jamendo_tag": "jazztrio", "openverse_q": "jazz trio"},
        ],
    },
    {
        "id": "classical",
        "label": "클래식",
        "theme": "오케스트라·피아노·현악·바로크",
        "jamendo_tag": "classical",
        "openverse_q": "classical",
        "openverse_extra_q": "piano orchestra",
        "subthemes": [
            {"id": "orchestra", "label": "오케스트라", "jamendo_tag": "orchestral", "openverse_q": "classical orchestra"},
            {"id": "piano", "label": "피아노", "jamendo_tag": "piano", "openverse_q": "classical piano"},
            {"id": "strings", "label": "현악", "jamendo_tag": "strings", "openverse_q": "chamber strings"},
            {"id": "baroque", "label": "바로크", "jamendo_tag": "baroque", "openverse_q": "baroque classical"},
        ],
    },
    {
        "id": "pop",
        "label": "팝",
        "theme": "팝송·어쿠스틱·일렉트로닉 팝",
        "jamendo_tag": "pop",
        "openverse_q": "pop",
        "openverse_extra_q": "acoustic song",
        "subthemes": [
            {"id": "popsong", "label": "팝송", "jamendo_tag": "pop", "openverse_q": "pop song"},
            {"id": "acoustic", "label": "어쿠스틱", "jamendo_tag": "acoustic", "openverse_q": "acoustic pop"},
            {"id": "electronic", "label": "일렉트로닉 팝", "jamendo_tag": "electronic", "openverse_q": "electronic pop"},
            {"id": "indie", "label": "인디", "jamendo_tag": "indie", "openverse_q": "indie pop"},
        ],
    },
    {
        "id": "rock",
        "label": "록",
        "theme": "얼터너티브·인디·소프트 록",
        "jamendo_tag": "rock",
        "openverse_q": "rock",
        "openverse_extra_q": "indie rock alternative",
        "subthemes": [
            {"id": "alternative", "label": "얼터너티브", "jamendo_tag": "alternativerock", "openverse_q": "alternative rock"},
            {"id": "indie", "label": "인디 록", "jamendo_tag": "indierock", "openverse_q": "indie rock"},
            {"id": "soft", "label": "소프트 록", "jamendo_tag": "softrock", "openverse_q": "soft rock"},
        ],
    },
    {
        "id": "folkhiphop",
        "label": "포크·힙합",
        "theme": "포크·어쿠스틱·힙합·랩",
        "jamendo_tag": "folk",
        "openverse_q": "folk",
        "openverse_extra_q": "hip hop acoustic",
        "subthemes": [
            {"id": "folk", "label": "포크", "jamendo_tag": "folk", "openverse_q": "folk music"},
            {"id": "acoustic", "label": "어쿠스틱", "jamendo_tag": "acoustic", "openverse_q": "acoustic folk"},
            {"id": "hiphop", "label": "힙합", "jamendo_tag": "hiphop", "openverse_q": "hip hop"},
            {"id": "rap", "label": "랩", "jamendo_tag": "rap", "openverse_q": "rap hip hop"},
        ],
    },
]

NC_LICENSE_RE = re.compile(r"nc", re.I)


def music_genres() -> list[dict[str, Any]]:
    return [
        {
            "id": g["id"],
            "label": g["label"],
            "theme": g.get("theme", ""),
            "subthemes": [
                {"id": st["id"], "label": st["label"]}
                for st in (g.get("subthemes") or [])
            ],
        }
        for g in GENRES
    ]


def _genre_config(genre_id: str) -> dict[str, Any]:
    for g in GENRES:
        if g["id"] == genre_id:
            return g
    raise ValueError(f"Unknown genre: {genre_id}")


def _resolve_genre_query(genre_id: str, subtheme_id: str | None = None) -> dict[str, str]:
    genre = _genre_config(genre_id)
    effective = {
        "id": genre["id"],
        "label": genre["label"],
        "theme": genre.get("theme", ""),
        "jamendo_tag": genre["jamendo_tag"],
        "openverse_q": genre["openverse_q"],
        "openverse_extra_q": genre.get("openverse_extra_q") or genre["openverse_q"],
        "subtheme_id": "",
        "subtheme_label": "",
    }
    sid = (subtheme_id or "").strip()
    if not sid:
        return effective
    for st in genre.get("subthemes") or []:
        if st.get("id") == sid:
            effective["jamendo_tag"] = str(st.get("jamendo_tag") or genre["jamendo_tag"])
            effective["openverse_q"] = str(st.get("openverse_q") or genre["openverse_q"])
            effective["openverse_extra_q"] = str(st.get("openverse_q") or genre.get("openverse_extra_q") or genre["openverse_q"])
            effective["subtheme_id"] = sid
            effective["subtheme_label"] = str(st.get("label") or sid)
            return effective
    raise ValueError(f"Unknown subtheme: {sid} for genre {genre_id}")


def _http_json(url: str, headers: dict[str, str] | None = None, timeout: float = 25.0) -> Any:
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "DigitalWorld-Music/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def _is_nc_license(license_slug: str, license_url: str = "") -> bool:
    combined = f"{license_slug} {license_url}".lower()
    return bool(NC_LICENSE_RE.search(combined))


def _license_stream_ok(license_slug: str, license_url: str = "") -> bool:
    slug = (license_slug or "").lower().replace("_", "-")
    combined = f"{slug} {license_url}".lower()
    if slug in ("cc0", "pdm", "pd", "publicdomain", "public-domain"):
        return True
    if slug.startswith("by"):
        return True
    if "creativecommons.org/publicdomain" in combined:
        return True
    if "creativecommons.org/licenses/by" in combined:
        return True
    return False


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
    if not _license_stream_ok(license_slug, license_url):
        return None
    if duration_ms is not None and duration_ms < MIN_TRACK_MS:
        return None
    nc = _is_nc_license(license_slug, license_url)
    lic_label = license_slug.upper().replace("-", " ") if license_slug else "CC"
    if nc and "NC" not in lic_label:
        lic_label = f"{lic_label} NC"
    return {
        "id": f"{source}:{track_id}",
        "source": source,
        "source_id": str(track_id),
        "title": title,
        "artist": artist or "Unknown artist",
        "year": str(year) if year else "",
        "thumbnail": thumbnail or "",
        "license": license_slug,
        "license_label": lic_label,
        "license_url": license_url,
        "nc": nc,
        "attribution": attribution,
        "duration_ms": duration_ms or 0,
        "instruments": instruments or [],
        "stream_path": f"/api/music/stream/{source}/{urllib.parse.quote(str(track_id), safe='')}",
        "_upstream_url": upstream_url,
    }


def _jamendo_track_id_from_row(row: dict[str, Any]) -> str:
    landing = str(row.get("foreign_landing_url") or "")
    m = re.search(r"jamendo\.com/track/(\d+)", landing, re.I)
    if m:
        return m.group(1)
    return str(row.get("id") or "")


def _fetch_jamendo_page(
    genre: dict[str, str],
    limit: int,
    offset: int,
    namesearch: str | None = None,
) -> list[dict[str, Any]]:
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
    if namesearch:
        params["namesearch"] = namesearch
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
        if not isinstance(musicinfo, dict):
            musicinfo = {}
        tags = musicinfo.get("tags") or {}
        if not isinstance(tags, dict):
            tags = {}
        instruments: list[str] = []
        raw_instruments = tags.get("instruments")
        if isinstance(raw_instruments, list):
            for item in raw_instruments[:4]:
                if isinstance(item, dict):
                    instruments.append(str(item.get("name") or item))
                else:
                    instruments.append(str(item))
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


def _fetch_jamendo_pool(
    genre: dict[str, str],
    target: int,
    offset_start: int,
    namesearch: str | None = None,
) -> list[dict[str, Any]]:
    """Scan multiple Jamendo pages until enough streamable tracks are found."""
    collected: list[dict[str, Any]] = []
    offset = offset_start
    while len(collected) < target and offset < JAMENDO_MAX_SCAN:
        batch = _fetch_jamendo_page(genre, JAMENDO_BATCH_SIZE, offset, namesearch=namesearch)
        if not batch:
            break
        collected.extend(batch)
        if len(batch) < JAMENDO_BATCH_SIZE:
            break
        offset += JAMENDO_BATCH_SIZE
    return collected


def _parse_openverse_track(row: dict[str, Any]) -> dict[str, Any] | None:
    provider = str(row.get("provider") or row.get("source") or "")
    duration_ms = int(row.get("duration") or 0)
    if duration_ms and duration_ms < MIN_TRACK_MS:
        return None
    if provider == "freesound" and duration_ms < 90_000:
        return None
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
    if provider == "jamendo":
        jamendo_id = _jamendo_track_id_from_row(row)
        return _serialize_track(
            source="jamendo",
            track_id=jamendo_id,
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
    if track and duration_ms >= MIN_TRACK_MS:
        return track
    return None


def _fetch_openverse(
    genre: dict[str, str],
    limit: int,
    page: int,
    extra_q: str | None = None,
) -> tuple[list[dict[str, Any]], int, int]:
    q = genre["openverse_q"]
    if extra_q:
        q = f"{q} {extra_q}".strip()
    params = {
        "q": q,
        "category": "music",
        "source": "jamendo",
        "page_size": str(min(max(limit, 10), 20)),
        "page": str(page),
    }
    url = f"{OPENVERSE_API}?{urllib.parse.urlencode(params)}"
    data = _http_json(url)
    page_count = int(data.get("page_count") or 0)
    result_count = int(data.get("result_count") or 0)
    results: list[dict[str, Any]] = []
    for row in data.get("results") or []:
        track = _parse_openverse_track(row)
        if track:
            results.append(track)
    return results[:limit], result_count, page_count


def _fetch_openverse_extra(
    genre: dict[str, str],
    limit: int,
    page: int,
    extra_q: str | None = None,
) -> list[dict[str, Any]]:
    alt_q = genre.get("openverse_extra_q") or genre["openverse_q"]
    if extra_q:
        alt_q = f"{alt_q} {extra_q}".strip()
    params = {
        "q": alt_q,
        "category": "music",
        "source": "jamendo",
        "page_size": str(min(max(limit, 10), 20)),
        "page": str(page),
    }
    url = f"{OPENVERSE_API}?{urllib.parse.urlencode(params)}"
    try:
        data = _http_json(url)
    except urllib.error.HTTPError:
        return []
    results: list[dict[str, Any]] = []
    for row in data.get("results") or []:
        track = _parse_openverse_track(row)
        if track:
            results.append(track)
    return results[:limit]


def fetch_tracks(
    genre_id: str,
    page: int = 1,
    limit: int = PAGE_SIZE_DEFAULT,
    q: str | None = None,
    subtheme_id: str | None = None,
) -> dict[str, Any]:
    genre = _resolve_genre_query(genre_id, subtheme_id)
    page = max(1, page)
    limit = max(1, min(limit, 20))
    offset = (page - 1) * limit
    search_q = (q or "").strip()[:120] or None

    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    ov_total = 0
    ov_pages = 0

    def add_batch(batch: list[dict[str, Any]]) -> None:
        for t in batch:
            key = _track_key(t)
            if key in seen:
                continue
            seen.add(key)
            merged.append(t)

    try:
        ov_batch, ov_total, ov_pages = _fetch_openverse(
            genre, max(limit * 2, 20), page, extra_q=search_q
        )
        add_batch(ov_batch)
        if len(merged) < limit * 2:
            add_batch(_fetch_openverse_extra(genre, max(limit * 2, 20), page, extra_q=search_q))
    except urllib.error.HTTPError:
        pass

    if JAMENDO_CLIENT_ID:
        jamendo_offset = (page - 1) * JAMENDO_BATCH_SIZE
        jamendo_pool = _fetch_jamendo_pool(
            genre,
            target=max(limit * 4, 40),
            offset_start=jamendo_offset,
            namesearch=search_q,
        )
        add_batch(jamendo_pool)

    if search_q:
        needle = search_q.lower()
        merged = [
            t
            for t in merged
            if needle in (t.get("title") or "").lower()
            or needle in (t.get("artist") or "").lower()
            or any(needle in str(i).lower() for i in (t.get("instruments") or []))
        ]

    page_tracks = merged[:limit]
    matched_total = len(merged)
    for t in page_tracks:
        upstream = t.pop("_upstream_url", None)
        if upstream:
            _cache_upstream(t["id"], upstream)

    has_jamendo = bool(JAMENDO_CLIENT_ID)
    sources_note = []
    if has_jamendo:
        sources_note.append("Jamendo")
    sources_note.append("Openverse")

    est_total = ov_total if ov_total else matched_total
    if matched_total > limit:
        est_total = max(est_total, offset + matched_total)
    elif page_tracks and len(merged) > limit:
        est_total = max(est_total, offset + len(page_tracks) + limit)
    has_more = len(merged) > limit or (ov_pages > 0 and page < ov_pages)
    if has_more and est_total <= offset + len(page_tracks):
        est_total = offset + matched_total + (1 if matched_total > limit else 0)

    return {
        "genre": genre_id,
        "genre_theme": genre.get("theme", ""),
        "subtheme": genre.get("subtheme_id") or "",
        "subtheme_label": genre.get("subtheme_label") or "",
        "query": search_q or "",
        "page": page,
        "limit": limit,
        "tracks": page_tracks,
        "result_count": len(page_tracks),
        "matched_total": matched_total,
        "total_estimate": est_total,
        "has_more": has_more,
        "sources": sources_note,
        "api_status": {
            "jamendo": has_jamendo,
            "openverse": True,
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
) -> tuple[bytes, int, int | None, str, str, str]:
    headers = {"User-Agent": "DigitalWorld-Music/1.0"}
    if range_header:
        headers["Range"] = range_header
    req = urllib.request.Request(upstream_url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        content_type = resp.headers.get("Content-Type", "audio/mpeg")
        status = resp.status
        content_range = resp.headers.get("Content-Range", "")
        content_length = resp.headers.get("Content-Length", "")
        total_size: int | None = None
        if content_range:
            m = re.search(r"/(\d+)$", content_range)
            if m:
                total_size = int(m.group(1))
        data = resp.read(max_bytes)
        if not content_length and data:
            content_length = str(len(data))
        if status == 206 and not content_range and range_header and data:
            m_rng = re.match(r"bytes=(\d+)-(\d*)", range_header.strip())
            if m_rng:
                start = int(m_rng.group(1))
                end_in_hdr = m_rng.group(2)
                end = int(end_in_hdr) if end_in_hdr else start + len(data) - 1
                total = total_size if total_size is not None else max(end + 1, start + len(data))
                content_range = f"bytes {start}-{start + len(data) - 1}/{total}"
        return data, status, total_size, content_type, content_range, content_length


_COMPOSER_FILE_RE = re.compile(r"^[\w.,()'\- \u00c0-\u017f\u0100-\u024f]+$")
_composer_image_cache: dict[str, tuple[float, bytes, str]] = {}
_COMPOSER_IMAGE_CACHE_TTL = 86400


def fetch_composer_image(filename: str) -> tuple[bytes, str]:
    name = (filename or "").strip()
    if not name or not _COMPOSER_FILE_RE.match(name):
        raise ValueError("Invalid composer image filename")
    cached = _composer_image_cache.get(name)
    if cached and cached[0] > time.time():
        return cached[1], cached[2]
    url = (
        "https://commons.wikimedia.org/wiki/Special:FilePath/"
        + urllib.parse.quote(name)
        + "?width=240"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "DigitalWorld-Music/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read(600_000)
        content_type = resp.headers.get("Content-Type", "image/jpeg")
    if not data:
        raise ValueError("Empty composer image")
    _composer_image_cache[name] = (time.time() + _COMPOSER_IMAGE_CACHE_TTL, data, content_type)
    return data, content_type
