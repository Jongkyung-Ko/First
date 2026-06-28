"""Art Institute of Chicago API integration for the ART page."""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from html import unescape
from typing import Any

ARTIC_BASE = "https://api.artic.edu/api/v1"
ARTIC_UA = "DigitalWorld-ART/1.0 (educational; github.com/Jongkyung-Ko/First)"
IIIF_BASE = "https://www.artic.edu/iiif/2"

_CACHE: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 3600

GENRES: list[dict[str, str]] = [
    {
        "id": "history",
        "label": "역사화",
        "label_en": "History Painting",
        "search": "history painting narrative",
        "hint": "역사·신화·종교적 장면을 그린 회화",
    },
    {
        "id": "portrait",
        "label": "초상화",
        "label_en": "Portrait",
        "search": "portrait painting",
        "hint": "인물의 얼굴과 성격을 담은 회화",
    },
    {
        "id": "landscape",
        "label": "풍경화",
        "label_en": "Landscape",
        "search": "landscape painting",
        "hint": "자연과 풍경을 주제로 한 회화",
    },
    {
        "id": "genre",
        "label": "풍속화",
        "label_en": "Genre Painting",
        "search": "genre painting everyday life",
        "hint": "일상과 풍속을 담은 회화",
    },
    {
        "id": "still_life",
        "label": "정물화",
        "label_en": "Still Life",
        "search": "still life painting",
        "hint": "정물·꽃·과일 등을 배치한 회화",
    },
]

ERAS: list[dict[str, Any]] = [
    {
        "id": "renaissance",
        "label": "르네상스",
        "period": "15–16세기",
        "artists": [
            "Leonardo da Vinci",
            "Michelangelo",
            "Raphael",
            "Titian",
            "Sandro Botticelli",
        ],
    },
    {
        "id": "baroque",
        "label": "바로크",
        "period": "17세기",
        "artists": [
            "Rembrandt van Rijn",
            "Caravaggio",
            "Peter Paul Rubens",
            "Diego Velázquez",
            "Artemisia Gentileschi",
        ],
    },
    {
        "id": "rococo",
        "label": "로코코",
        "period": "18세기 초",
        "artists": [
            "Jean-Antoine Watteau",
            "François Boucher",
            "Jean-Honoré Fragonard",
            "Giovanni Battista Tiepolo",
            "Canaletto",
        ],
    },
    {
        "id": "romanticism",
        "label": "낭만주의",
        "period": "18–19세기",
        "artists": [
            "Eugène Delacroix",
            "Francisco Goya",
            "J.M.W. Turner",
            "John Constable",
            "Jacques-Louis David",
        ],
    },
    {
        "id": "impressionism",
        "label": "인상주의",
        "period": "19세기 후반",
        "artists": [
            "Claude Monet",
            "Edgar Degas",
            "Pierre-Auguste Renoir",
            "Camille Pissarro",
            "Mary Cassatt",
        ],
    },
    {
        "id": "modern",
        "label": "근대·현대",
        "period": "19–20세기",
        "artists": [
            "Vincent van Gogh",
            "Paul Cézanne",
            "Paul Gauguin",
            "Henri Matisse",
            "Pablo Picasso",
        ],
    },
]

WORK_FIELDS = "id,title,artist_title,date_display,image_id,description,thumbnail,classification_titles"
AGENT_FIELDS = "id,title,description,image_id,thumbnail,birth_date,end_date"
_IMAGE_ID_RE = re.compile(r"^[a-f0-9-]{36}$", re.I)
_IMAGE_BYTES_CACHE: dict[str, tuple[float, bytes, str]] = {}
_IMAGE_BYTES_TTL = 86400

# Wikimedia Commons portrait filenames for era artists
ARTIST_WIKI: dict[str, str] = {
    "Leonardo da Vinci": "Leonardo da Vinci - Presumed self-portrait - WGA12798.jpg",
    "Michelangelo": "Michelangelo Buonarroti by Daniele da Volterra.jpg",
    "Raphael": "Raffaello Sanzio.jpg",
    "Titian": "Titian Selfportrait.jpg",
    "Sandro Botticelli": "Sandro Botticelli 083.jpg",
    "Rembrandt van Rijn": "Rembrandt Harmensz. van Rijn 063.jpg",
    "Caravaggio": "Caravaggio.jpg",
    "Peter Paul Rubens": "Peter Paul Rubens Self-portrait circa 1620.jpg",
    "Diego Velázquez": "Diego Velazquez.jpg",
    "Artemisia Gentileschi": "Artemisia Gentileschi - Self-Portrait as the Allegory of Painting.jpg",
    "Jean-Antoine Watteau": "Antoine Watteau by Rosalba Carriera.jpg",
    "François Boucher": "François Boucher by Gustav Lundberg.jpg",
    "Jean-Honoré Fragonard": "Jean-Honoré Fragonard.jpg",
    "Giovanni Battista Tiepolo": "Giovanni Battista Tiepolo by Alexandre Roslin.jpg",
    "Canaletto": "Canaletto.jpg",
    "Eugène Delacroix": "Eugène Delacroix 1837.jpg",
    "Francisco Goya": "Goya - Portrait of Francisco Bayeu.jpg",
    "J.M.W. Turner": "J.M.W. Turner.jpg",
    "John Constable": "John Constable by Daniel Gardner.jpg",
    "Jacques-Louis David": "Jacques-Louis David - selfportrait.jpg",
    "Claude Monet": "Claude Monet 1899 Nadar crop.jpg",
    "Edgar Degas": "Edgar Degas self portrait 1855.jpeg",
    "Pierre-Auguste Renoir": "Pierre-Auguste Renoir.jpg",
    "Camille Pissarro": "Camille Pissarro.jpg",
    "Mary Cassatt": "Mary Cassatt Self Portrait c1878.jpg",
    "Vincent van Gogh": "Vincent van Gogh - Self-Portrait - Google Art Project (454045).jpg",
    "Paul Cézanne": "Paul Cézanne.jpg",
    "Paul Gauguin": "Paul Gauguin 1891.png",
    "Henri Matisse": "Henri Matisse, 1913, photograph by Alvin Langdon Coburn.jpg",
    "Pablo Picasso": "Pablo picasso.jpg",
}


def strip_html(value: str | None) -> str:
    if not value:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    text = re.sub(r"</p>", "\n\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return unescape(re.sub(r"\n{3,}", "\n\n", text)).strip()


def image_url(image_id: str | None, width: int = 843) -> str | None:
    if not image_id:
        return None
    return f"{IIIF_BASE}/{image_id}/full/{width},/0/default.jpg"


def proxy_image_path(image_id: str | None, width: int = 400) -> str | None:
    if not image_id:
        return None
    return f"/api/art/image/{image_id}?w={width}"


def portrait_proxy_path(name: str, width: int | None = None) -> str:
    base = f"/api/art/portrait?name={urllib.parse.quote(name)}"
    if width:
        return f"{base}&w={width}"
    return base


def _lqip_from_item(item: dict[str, Any]) -> str:
    thumb = item.get("thumbnail") or {}
    if isinstance(thumb, dict):
        return thumb.get("lqip") or ""
    return ""


def _image_fetch_headers() -> dict[str, str]:
    return {
        "AIC-User-Agent": ARTIC_UA,
        "User-Agent": ARTIC_UA,
        "Referer": "https://www.artic.edu/",
        "Accept": "image/avif,image/webp,image/apng,image/jpeg,image/*,*/*;q=0.8",
    }


def _fetch_bytes(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: int = 45,
    max_bytes: int = 2_500_000,
) -> tuple[bytes, str]:
    headers = headers or {}
    try:
        from curl_cffi import requests as cffi_requests

        resp = cffi_requests.get(
            url,
            headers=headers,
            impersonate="chrome",
            timeout=timeout,
        )
        if resp.status_code == 200 and resp.content:
            data = resp.content[:max_bytes]
            content_type = resp.headers.get("Content-Type", "image/jpeg")
            return data, content_type
    except Exception:
        pass

    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read(max_bytes)
        content_type = resp.headers.get("Content-Type", "image/jpeg")
    if not data:
        raise ValueError("Empty response")
    return data, content_type


def fetch_art_image(image_id: str, width: int = 400) -> tuple[bytes, str]:
    if not image_id or not _IMAGE_ID_RE.match(image_id):
        raise ValueError("Invalid image id")
    width = max(120, min(int(width), 843))
    cache_key = f"{image_id}:{width}"
    cached = _IMAGE_BYTES_CACHE.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1], cached[2]

    url = image_url(image_id, width)
    if not url:
        raise ValueError("Missing image url")
    data, content_type = _fetch_bytes(url, headers=_image_fetch_headers())
    _IMAGE_BYTES_CACHE[cache_key] = (time.time() + _IMAGE_BYTES_TTL, data, content_type)
    return data, content_type


def fetch_portrait_image(name: str, width: int = 320) -> tuple[bytes, str]:
    width = max(120, min(int(width), 640))
    cache_key = f"portrait:{name.lower()}:{width}"
    cached = _IMAGE_BYTES_CACHE.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1], cached[2]

    thumb_url = _resolve_portrait_thumb_url(name, width)
    if not thumb_url:
        raise ValueError("Portrait not found")

    data, content_type = _fetch_bytes(
        thumb_url,
        headers={"User-Agent": "DigitalWorld-ART/1.0"},
        max_bytes=800_000,
    )
    _IMAGE_BYTES_CACHE[cache_key] = (time.time() + _IMAGE_BYTES_TTL, data, content_type)
    return data, content_type


def _resolve_portrait_thumb_url(name: str, width: int) -> str | None:
    filename = ARTIST_WIKI.get(name)
    if filename:
        thumb = _wikimedia_thumb_url(filename, width)
        if thumb:
            return thumb

    for query in (f"{name} portrait", f"{name} self-portrait", name):
        thumb = _wikimedia_search_thumb(query, width)
        if thumb:
            return thumb
    return None


def _wikimedia_search_thumb(query: str, width: int) -> str | None:
    cache_key = f"wiki-search:{query.lower()}:{width}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached or None

    api_url = (
        "https://commons.wikimedia.org/w/api.php?"
        + urllib.parse.urlencode(
            {
                "action": "query",
                "generator": "search",
                "gsrnamespace": "6",
                "gsrsearch": f'filetype:bitmap "{query}"',
                "gsrlimit": "8",
                "prop": "imageinfo",
                "iiprop": "url",
                "iiurlwidth": str(width),
                "format": "json",
            }
        )
    )
    req = urllib.request.Request(api_url, headers={"User-Agent": "DigitalWorld-ART/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    pages = payload.get("query", {}).get("pages", {})
    best: tuple[int, str] | None = None
    q = query.lower()
    for page in pages.values():
        if page.get("missing") is not None:
            continue
        title = (page.get("title") or "").lower()
        score = 0
        if "self-portrait" in title or "self portrait" in title:
            score += 4
        if "portrait" in title:
            score += 3
        for part in q.split():
            if len(part) > 2 and part in title:
                score += 2
        info = (page.get("imageinfo") or [{}])[0]
        thumb = info.get("thumburl") or info.get("url")
        if not thumb:
            continue
        if best is None or score > best[0]:
            best = (score, thumb)
    result = best[1] if best else ""
    _cache_set(cache_key, result)
    return result or None


def _wikimedia_thumb_url(filename: str, width: int) -> str | None:
    cache_key = f"wiki-thumb:{filename}:{width}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached or None

    title = filename if filename.startswith("File:") else f"File:{filename}"
    api_url = (
        "https://commons.wikimedia.org/w/api.php?"
        + urllib.parse.urlencode(
            {
                "action": "query",
                "titles": title,
                "prop": "imageinfo",
                "iiprop": "url",
                "iiurlwidth": str(width),
                "format": "json",
            }
        )
    )
    req = urllib.request.Request(api_url, headers={"User-Agent": "DigitalWorld-ART/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    pages = payload.get("query", {}).get("pages", {})
    for page in pages.values():
        if page.get("missing") is not None:
            continue
        info = (page.get("imageinfo") or [{}])[0]
        result = info.get("thumburl") or info.get("url")
        _cache_set(cache_key, result or "")
        return result
    _cache_set(cache_key, "")
    return None


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


def _artic_request(path: str, params: dict[str, Any] | None = None) -> Any:
    url = f"{ARTIC_BASE}{path}"
    if params:
        clean = {k: v for k, v in params.items() if v is not None and v != ""}
        if clean:
            url = f"{url}?{urllib.parse.urlencode(clean)}"
    req = urllib.request.Request(url, headers={"AIC-User-Agent": ARTIC_UA})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _normalize_work(item: dict[str, Any]) -> dict[str, Any] | None:
    image_id = item.get("image_id")
    if not image_id:
        return None
    description = strip_html(item.get("description"))
    if not description:
        classification = item.get("classification_titles") or []
        if classification:
            description = " · ".join(classification[:3])
        else:
            description = "시카고 미술관 소장 작품"
    return {
        "id": item.get("id"),
        "title": item.get("title") or "Untitled",
        "artist": item.get("artist_title") or "Unknown Artist",
        "date": item.get("date_display") or "",
        "description": description,
        "image_id": image_id,
        "lqip": _lqip_from_item(item),
        "preview_url": proxy_image_path(image_id, 200),
        "image_url": proxy_image_path(image_id, 843),
        "thumb_url": proxy_image_path(image_id, 400),
        "direct_preview_url": image_url(image_id, 200),
        "direct_thumb_url": image_url(image_id, 400),
        "direct_image_url": image_url(image_id, 843),
    }


def _search_artworks(query: str, limit: int = 20) -> list[dict[str, Any]]:
    cache_key = f"works:v3:{query}:{limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    payload = _artic_request(
        "/artworks/search",
        {
            "q": query,
            "fields": WORK_FIELDS,
            "limit": min(limit * 4, 80),
            "query[term][is_public_domain]": "true",
        },
    )
    works: list[dict[str, Any]] = []
    seen: set[int] = set()
    for item in payload.get("data") or []:
        work = _normalize_work(item)
        if not work or work["id"] in seen:
            continue
        seen.add(work["id"])
        works.append(work)
        if len(works) >= limit:
            break

    return _cache_set(cache_key, works)


def art_genres_list() -> list[dict[str, str]]:
    return GENRES


def fetch_genre_works(genre_id: str, limit: int = 20) -> dict[str, Any]:
    genre = next((g for g in GENRES if g["id"] == genre_id), None)
    if not genre:
        raise ValueError(f"Unknown genre: {genre_id}")
    works = _search_artworks(genre["search"], limit=limit)
    return {"genre": genre, "works": works, "count": len(works)}


def _search_agent(name: str) -> dict[str, Any] | None:
    cache_key = f"agent:{name.lower()}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    payload = _artic_request(
        "/agents/search",
        {"q": name, "fields": AGENT_FIELDS, "limit": 5},
    )
    target = name.lower()
    agent = None
    for item in payload.get("data") or []:
        title = (item.get("title") or "").lower()
        if title == target or target in title:
            agent = item
            break
    if not agent and payload.get("data"):
        agent = payload["data"][0]

    if not agent:
        result = None
    else:
        result = {
            "id": agent.get("id"),
            "name": agent.get("title") or name,
            "description": strip_html(agent.get("description"))
            or f"{name} — 시카고 미술관 컬렉션의 대표 화가입니다.",
            "birth_date": agent.get("birth_date") or "",
            "end_date": agent.get("end_date") or "",
            "image_id": agent.get("image_id"),
            "image_url": portrait_proxy_path(name, 320)
            if name in ARTIST_WIKI
            else proxy_image_path(agent.get("image_id"), 400),
        }

    return _cache_set(cache_key, result)


def _artist_portrait(name: str, works: list[dict[str, Any]]) -> dict[str, str | None]:
    if name in ARTIST_WIKI:
        return {
            "preview_url": portrait_proxy_path(name, 120),
            "thumb_url": portrait_proxy_path(name, 200),
            "image_url": portrait_proxy_path(name, 320),
        }
    for work in works:
        if work.get("preview_url") or work.get("thumb_url"):
            return {
                "preview_url": work.get("preview_url"),
                "thumb_url": work.get("thumb_url"),
                "image_url": work.get("image_url"),
            }
        if work.get("lqip"):
            return {
                "preview_url": None,
                "thumb_url": None,
                "image_url": None,
                "lqip": work["lqip"],
            }
    return {"preview_url": None, "thumb_url": None, "image_url": None}


def _artist_works(name: str, limit: int = 60) -> list[dict[str, Any]]:
    cache_key = f"artist-works:{name.lower()}:{limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    payload = _artic_request(
        "/artworks/search",
        {
            "q": f'artist:"{name}"',
            "fields": WORK_FIELDS,
            "limit": min(limit * 2, 100),
        },
    )
    works: list[dict[str, Any]] = []
    seen: set[int] = set()
    for item in payload.get("data") or []:
        work = _normalize_work(item)
        if not work or work["id"] in seen:
            continue
        seen.add(work["id"])
        works.append(work)

    if not works:
        works = _search_artworks(name, limit=min(limit, 20))

    return _cache_set(cache_key, works)


def _artist_card(name: str, era: dict[str, Any]) -> dict[str, Any]:
    agent = _search_agent(name)
    works = _artist_works(name, limit=8)
    portrait = _artist_portrait(name, works)
    lqip = works[0].get("lqip") if works else ""

    life = ""
    if agent:
        birth = agent.get("birth_date") or ""
        end = agent.get("end_date") or ""
        if birth or end:
            life = f"{birth} – {end}".strip(" –")

    return {
        "name": agent["name"] if agent else name,
        "era_id": era["id"],
        "era_label": era["label"],
        "period": era.get("period") or "",
        "life": life,
        "description": (agent or {}).get("description")
        or f"{name}은(는) {era['label']} 시기를 대표하는 화가입니다.",
        "preview_url": portrait.get("preview_url"),
        "thumb_url": portrait.get("thumb_url"),
        "image_url": portrait.get("image_url"),
        "lqip": portrait.get("lqip") or lqip,
        "sample_count": len(works),
    }


def fetch_eras_artists() -> list[dict[str, Any]]:
    cache_key = "eras:v3:all"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    result: list[dict[str, Any]] = []
    for era in ERAS:
        artists = [_artist_card(name, era) for name in era["artists"]]
        result.append(
            {
                "id": era["id"],
                "label": era["label"],
                "period": era.get("period") or "",
                "artists": artists,
            }
        )
    return _cache_set(cache_key, result)


def fetch_artist_works(name: str, limit: int = 60) -> dict[str, Any]:
    agent = _search_agent(name)
    works = _artist_works(name, limit=limit)
    portrait = _artist_portrait(name, works)
    return {
        "artist": {
            "name": agent["name"] if agent else name,
            "description": (agent or {}).get("description") or "",
            "life": (
                f"{agent.get('birth_date', '')} – {agent.get('end_date', '')}".strip(" –")
                if agent
                else ""
            ),
            "preview_url": portrait.get("preview_url"),
            "thumb_url": portrait.get("thumb_url"),
            "image_url": portrait.get("image_url"),
            "lqip": portrait.get("lqip") or (works[0].get("lqip") if works else ""),
        },
        "works": works,
        "count": len(works),
    }
