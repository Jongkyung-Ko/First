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
        "image_url": image_url(image_id),
        "thumb_url": image_url(image_id, 400),
    }


def _search_artworks(query: str, limit: int = 20) -> list[dict[str, Any]]:
    cache_key = f"works:{query}:{limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    payload = _artic_request(
        "/artworks/search",
        {
            "q": query,
            "fields": WORK_FIELDS,
            "limit": min(limit * 4, 80),
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
            "image_url": image_url(agent.get("image_id"), 400),
        }

    return _cache_set(cache_key, result)


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
    portrait = None
    if agent and agent.get("image_url"):
        portrait = agent["image_url"]
    elif works:
        portrait = works[0].get("thumb_url")

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
        "image_url": portrait,
        "sample_count": len(works),
    }


def fetch_eras_artists() -> list[dict[str, Any]]:
    cache_key = "eras:all"
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
    portrait = None
    if agent and agent.get("image_url"):
        portrait = agent["image_url"]
    elif works:
        portrait = works[0].get("thumb_url")
    return {
        "artist": {
            "name": agent["name"] if agent else name,
            "description": (agent or {}).get("description") or "",
            "life": (
                f"{agent.get('birth_date', '')} – {agent.get('end_date', '')}".strip(" –")
                if agent
                else ""
            ),
            "image_url": portrait,
        },
        "works": works,
        "count": len(works),
    }
