"""Metropolitan Museum of Art API integration for the ART page."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from deep_translator import GoogleTranslator

MET_BASE = "https://collectionapi.metmuseum.org/public/collection/v1"
MET_UA = "DigitalWorld-ART/1.0 (educational; github.com/Jongkyung-Ko/First)"

_CACHE: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 3600
_KO_CACHE: dict[str, str] = {}

GENRES: list[dict[str, str]] = [
    {
        "id": "history",
        "label": "역사화",
        "label_en": "History Painting",
        "search": "history mythology biblical",
        "hint": "역사·신화·종교적 장면을 그린 회화",
    },
    {
        "id": "portrait",
        "label": "초상화",
        "label_en": "Portrait",
        "search": "portrait",
        "hint": "인물의 얼굴과 성격을 담은 회화",
    },
    {
        "id": "landscape",
        "label": "풍경화",
        "label_en": "Landscape",
        "search": "landscape",
        "hint": "자연과 풍경을 주제로 한 회화",
    },
    {
        "id": "genre",
        "label": "풍속화",
        "label_en": "Genre Painting",
        "search": "genre everyday life",
        "hint": "일상과 풍속을 담은 회화",
    },
    {
        "id": "still_life",
        "label": "정물화",
        "label_en": "Still Life",
        "search": "still life",
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
            "Rembrandt",
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

_IMAGE_BYTES_CACHE: dict[str, tuple[float, bytes, str]] = {}
_IMAGE_BYTES_TTL = 86400

ARTIST_WIKI: dict[str, str] = {
    "Leonardo da Vinci": "Leonardo da Vinci - Presumed self-portrait - WGA12798.jpg",
    "Michelangelo": "Michelangelo Buonarroti by Daniele da Volterra.jpg",
    "Raphael": "Raffaello Sanzio.jpg",
    "Titian": "Titian Selfportrait.jpg",
    "Sandro Botticelli": "Sandro Botticelli 083.jpg",
    "Rembrandt": "Rembrandt Harmensz. van Rijn 063.jpg",
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


def portrait_proxy_path(name: str, width: int | None = None) -> str:
    base = f"/api/art/portrait?name={urllib.parse.quote(name)}"
    if width:
        return f"{base}&w={width}"
    return base


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


def _met_request(path: str, params: dict[str, Any] | None = None) -> Any:
    url = f"{MET_BASE}{path}"
    if params:
        clean = {k: v for k, v in params.items() if v is not None and v != ""}
        if clean:
            url = f"{url}?{urllib.parse.urlencode(clean)}"
    req = urllib.request.Request(url, headers={"User-Agent": MET_UA})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _met_search(
    query: str,
    *,
    artist: bool = False,
    max_ids: int = 80,
) -> tuple[list[int], int]:
    cache_key = f"met-search:v1:{query.lower()}:artist={artist}"
    cached = _cache_get(cache_key)
    if cached is not None:
        ids, total = cached
        return list(ids[:max_ids]), total

    params: dict[str, Any] = {
        "q": query,
        "hasImages": "true",
        "isPublicDomain": "true",
    }
    if artist:
        params["artistOrCulture"] = "true"

    payload = _met_request("/search", params)
    ids = payload.get("objectIDs") or []
    total = int(payload.get("total") or 0)
    _cache_set(cache_key, (ids, total))
    return list(ids[:max_ids]), total


def _met_object(object_id: int) -> dict[str, Any] | None:
    cache_key = f"met-obj:{object_id}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached or None

    try:
        data = _met_request(f"/objects/{object_id}")
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            _cache_set(cache_key, {})
            return None
        raise

    if not data.get("objectID"):
        _cache_set(cache_key, {})
        return None
    return _cache_set(cache_key, data)


def _is_painting(obj: dict[str, Any]) -> bool:
    dept = (obj.get("department") or "").lower()
    if "painting" in dept:
        return True
    obj_name = (obj.get("objectName") or "").lower()
    if "painting" in obj_name:
        return True
    classification = str(obj.get("classification") or "").lower()
    return "painting" in classification


def _met_description(obj: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in (
        "medium",
        "culture",
        "period",
        "department",
        "classification",
        "objectName",
    ):
        val = obj.get(key)
        if val and str(val).strip():
            parts.append(str(val).strip())
    bio = obj.get("artistDisplayBio")
    if bio and str(bio).strip():
        parts.append(str(bio).strip())
    dims = obj.get("dimensions")
    if dims:
        parts.append(str(dims).strip())
    credit = obj.get("creditLine")
    if credit:
        parts.append(str(credit).strip())
    if not parts:
        return "미술관 소장 공개 도메인 회화 작품"
    return " · ".join(parts)


def _translate_ko(text: str) -> str:
    clean = (text or "").strip()
    if not clean:
        return clean
    cached = _KO_CACHE.get(clean)
    if cached is not None:
        return cached
    try:
        payload = clean[:4500]
        translated = GoogleTranslator(source="auto", target="ko").translate(payload)
        result = (translated or clean).strip()
    except Exception:
        result = clean
    _KO_CACHE[clean] = result
    return result


def _apply_korean_descriptions(works: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not works:
        return works
    pending = {w["description"] for w in works if w.get("description")}
    if not pending:
        return works

    translated: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(_translate_ko, text): text for text in pending}
        for future in as_completed(futures):
            original = futures[future]
            try:
                translated[original] = future.result()
            except Exception:
                translated[original] = original

    for work in works:
        desc = work.get("description")
        if desc and desc in translated:
            work["description"] = translated[desc]
    return works


def _met_image_urls(obj: dict[str, Any]) -> tuple[str, str, str] | None:
    thumb = (obj.get("primaryImageSmall") or "").strip()
    full = (obj.get("primaryImage") or thumb).strip()
    if not thumb and not full:
        return None
    if not thumb:
        thumb = full
    return thumb, thumb, full


def _normalize_met_object(obj: dict[str, Any]) -> dict[str, Any] | None:
    if not obj.get("isPublicDomain"):
        return None
    urls = _met_image_urls(obj)
    if not urls:
        return None
    preview, thumb, full = urls
    artist = (obj.get("artistDisplayName") or "").strip() or "Unknown Artist"
    return {
        "id": obj.get("objectID"),
        "title": obj.get("title") or "Untitled",
        "artist": artist,
        "date": obj.get("objectDate") or "",
        "description": _met_description(obj),
        "lqip": "",
        "preview_url": preview,
        "thumb_url": thumb,
        "image_url": full,
        "direct_preview_url": preview,
        "direct_thumb_url": thumb,
        "direct_image_url": full,
        "met_url": obj.get("objectURL") or "",
    }


def _fetch_met_works_from_ids(
    object_ids: list[int],
    limit: int = 20,
    *,
    paintings_only: bool = True,
) -> list[dict[str, Any]]:
    works: list[dict[str, Any]] = []
    seen: set[int] = set()
    for object_id in object_ids:
        if len(works) >= limit:
            break
        obj = _met_object(object_id)
        if not obj:
            continue
        if paintings_only and not _is_painting(obj):
            continue
        work = _normalize_met_object(obj)
        if not work or work["id"] in seen:
            continue
        seen.add(work["id"])
        works.append(work)
    return works


def _search_met_works(
    query: str,
    limit: int = 20,
    *,
    artist: bool = False,
) -> list[dict[str, Any]]:
    cache_key = f"met-works:v2:ko:{query.lower()}:a={artist}:n={limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    ids, _ = _met_search(query, artist=artist, max_ids=max(limit * 4, 40))
    works = _apply_korean_descriptions(_fetch_met_works_from_ids(ids, limit=limit))
    return _cache_set(cache_key, works)


def art_genres_list() -> list[dict[str, str]]:
    return GENRES


def fetch_genre_works(genre_id: str, limit: int = 20) -> dict[str, Any]:
    genre = next((g for g in GENRES if g["id"] == genre_id), None)
    if not genre:
        raise ValueError(f"Unknown genre: {genre_id}")
    works = _search_met_works(genre["search"], limit=limit)
    return {"genre": genre, "works": works, "count": len(works)}


def _artist_search_name(name: str) -> str:
    aliases = {
        "Rembrandt van Rijn": "Rembrandt",
        "Michelangelo": "Michelangelo Buonarroti",
    }
    return aliases.get(name, name)


def _artist_portrait(name: str) -> dict[str, str | None]:
    if name in ARTIST_WIKI or _artist_search_name(name) in ARTIST_WIKI:
        return {
            "preview_url": portrait_proxy_path(name, 120),
            "thumb_url": portrait_proxy_path(name, 200),
            "image_url": portrait_proxy_path(name, 320),
        }

    search_name = _artist_search_name(name)
    ids, _ = _met_search(search_name, artist=True, max_ids=6)
    for object_id in ids:
        obj = _met_object(object_id)
        if not obj:
            continue
        urls = _met_image_urls(obj)
        if not urls:
            continue
        preview, thumb, full = urls
        return {
            "preview_url": preview,
            "thumb_url": thumb,
            "image_url": full,
        }
    return {"preview_url": None, "thumb_url": None, "image_url": None}


def _artist_works(name: str, limit: int = 60) -> list[dict[str, Any]]:
    search_name = _artist_search_name(name)
    return _search_met_works(search_name, limit=limit, artist=True)


def _artist_card(name: str, era: dict[str, Any]) -> dict[str, Any]:
    search_name = _artist_search_name(name)
    _, total = _met_search(search_name, artist=True, max_ids=1)
    portrait = _artist_portrait(name)
    birth = ""
    end = ""

    return {
        "name": name,
        "era_id": era["id"],
        "era_label": era["label"],
        "period": era.get("period") or "",
        "life": f"{birth} – {end}".strip(" –"),
        "description": f"{name}은(는) {era['label']} 시기를 대표하는 화가입니다.",
        "preview_url": portrait.get("preview_url"),
        "thumb_url": portrait.get("thumb_url"),
        "image_url": portrait.get("image_url"),
        "lqip": "",
        "sample_count": total,
    }


def fetch_eras_artists() -> list[dict[str, Any]]:
    cache_key = "eras:met:v1:all"
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
    works = _artist_works(name, limit=limit)
    portrait = _artist_portrait(name)
    search_name = _artist_search_name(name)
    return {
        "artist": {
            "name": name,
            "description": f"{name} — 대표 작품 감상.",
            "life": "",
            "preview_url": portrait.get("preview_url"),
            "thumb_url": portrait.get("thumb_url"),
            "image_url": portrait.get("image_url"),
            "lqip": "",
        },
        "works": works,
        "count": len(works),
    }


def _fetch_bytes(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: int = 45,
    max_bytes: int = 800_000,
) -> tuple[bytes, str]:
    headers = headers or {"User-Agent": MET_UA}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read(max_bytes)
        content_type = resp.headers.get("Content-Type", "image/jpeg")
    if not data:
        raise ValueError("Empty response")
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

    data, content_type = _fetch_bytes(thumb_url)
    _IMAGE_BYTES_CACHE[cache_key] = (time.time() + _IMAGE_BYTES_TTL, data, content_type)
    return data, content_type


def _resolve_portrait_thumb_url(name: str, width: int) -> str | None:
    wiki_name = ARTIST_WIKI.get(name) or ARTIST_WIKI.get(_artist_search_name(name))
    if wiki_name:
        thumb = _wikimedia_thumb_url(wiki_name, width)
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
    req = urllib.request.Request(api_url, headers={"User-Agent": MET_UA})
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
    req = urllib.request.Request(api_url, headers={"User-Agent": MET_UA})
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
