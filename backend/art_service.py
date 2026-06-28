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

ARTIST_INFO: dict[str, dict[str, str]] = {
    "Leonardo da Vinci": {
        "life": "1452–1519",
        "description": "이탈리아 르네상스의 대표 화가·발명가. 인체와 자연을 관찰하며 균형 잡힌 구도와 부드러운 명암(스푸마토)로 인간의 내면을 그려냈습니다. 《모나리자》《최후의 만찬》 등이 대표작입니다.",
    },
    "Michelangelo": {
        "life": "1475–1564",
        "description": "조각가이자 화가, 건축가로 활동한 르네상스의 거장. 인체의 근육과 움직임을 극적으로 표현하며 웅장한 구도로 종교적·인간적 힘을 드러냈습니다. 시스티나 예배당 천장화가 대표작입니다.",
    },
    "Raphael": {
        "life": "1483–1520",
        "description": "조화롭고 우아한 색채와 균형 잡힌 구도로 르네상스 회화의 이상을 보여준 화가. 인물 배치와 원근법이 정교하며, 《아테네 학당》이 대표작입니다.",
    },
    "Titian": {
        "life": "c. 1488–1576",
        "description": "베네치아 화파의 대표 화가. 풍부한 색채와 자유로운 붓터치로 인물의 심리와 분위기를 생생하게 표현했습니다. 신화·초상·종교화를 넘나들며 후대 바로크에도 영향을 주었습니다.",
    },
    "Sandro Botticelli": {
        "life": "c. 1445–1510",
        "description": "플로렌스 르네상스 초기를 대표하는 화가. 섬세한 선과 꿈결 같은 색으로 신화와 종교를 그렸습니다. 《비너스의 탄생》《봄의 알레고리》가 대표작입니다.",
    },
    "Rembrandt": {
        "life": "1606–1669",
        "description": "네덜란드 황금시대 최고의 화가. 강렬한 명암 대비(키아로스쿠로)로 인물의 내면과 드라마를 포착했습니다. 수많은 자화상과 《밤의 순찰》이 대표작입니다.",
    },
    "Caravaggio": {
        "life": "1571–1610",
        "description": "극적인 빛과 그림자로 현실감 넘치는 종교·풍속화를 그린 바로크의 선구자. 인물을 일상의 공간에 배치해 관람자에게 강한 몰입감을 주었습니다.",
    },
    "Peter Paul Rubens": {
        "life": "1577–1640",
        "description": "역동적인 구도와 풍부한 색채로 바로크 회화를 대표한 플랑드르 화가. 신화·역사·종교 주제를 웅장하고 생동감 있게 그렸습니다.",
    },
    "Diego Velázquez": {
        "life": "1599–1660",
        "description": "스페인 왕실 화가이자 바로크의 거장. 사실적인 묘사와 빛의 처리로 인물의 위엄과 심리를 동시에 담아냈습니다. 《시녀들》이 대표작입니다.",
    },
    "Artemisia Gentileschi": {
        "life": "1593–c. 1656",
        "description": "카라바조의 영향을 받은 이탈리아 바로크 화가. 강인한 여성상과 극적인 빛으로 서사를 그렸으며, 당대 여성 화가의 대표 주자입니다.",
    },
    "Jean-Antoine Watteau": {
        "life": "1684–1721",
        "description": "로코코의 선구자. 귀족의 산책과 연회를 우아하고 몽환적인 분위기로 그린 ‘샹 드리’ 장르를 개척했습니다.",
    },
    "François Boucher": {
        "life": "1703–1770",
        "description": "프랑스 로코코를 대표하는 화가. 파스텔 톤과 장식적인 구도로 신화·풍속을 우아하고 화려하게 표현했습니다.",
    },
    "Jean-Honoré Fragonard": {
        "life": "1732–1806",
        "description": "가벼운 붓질과 밝은 색채로 연애와 유희의 순간을 그린 로코코 화가. 《그네를 타는 소녀》가 대표작입니다.",
    },
    "Giovanni Battista Tiepolo": {
        "life": "1696–1770",
        "description": "베네치아 출신의 바로크·로코코 화가. 천장화와 대형 종교화에서 빛나는 색과 공중에 떠 있는 듯한 인물 배치로 유명합니다.",
    },
    "Canaletto": {
        "life": "1697–1768",
        "description": "베네치아 풍경화의 대가. 정밀한 원근과 맑은 빛으로 도시의 운하와 광장을 사실적으로 기록했습니다.",
    },
    "Eugène Delacroix": {
        "life": "1798–1863",
        "description": "프랑스 낭만주의의 핵심 화가. 강렬한 색과 역동적인 구도로 혁명·역사·동방의 열정을 표현했습니다. 《민중을 이끄는 자유의 여신》이 대표작입니다.",
    },
    "Francisco Goya": {
        "life": "1746–1828",
        "description": "스페인을 대표하는 화가. 궁정 화가에서 비판적 시선의 거장으로 변모하며, 전쟁과 인간의 어두운 면을 담았습니다.",
    },
    "J.M.W. Turner": {
        "life": "1775–1851",
        "description": "영국 풍경화의 거장. 안개와 빛, 바다의 움직임을 색으로 용해시키듯 표현하며 인상주의 이전의 빛의 화가로 평가됩니다.",
    },
    "John Constable": {
        "life": "1776–1837",
        "description": "영국 시골 풍경을 사실적이고 서정적으로 그린 화가. 구름과 빛의 변화를 세밀히 관찰해 자연의 생동감을 담았습니다.",
    },
    "Jacques-Louis David": {
        "life": "1748–1825",
        "description": "신고전주의의 대표 화가. 명확한 윤곽과 극적인 구도로 혁명과 고대 로마의 영웅성을 그렸습니다.",
    },
    "Claude Monet": {
        "life": "1840–1926",
        "description": "인상주의의 대표 화가. 같은 대상을 시간대별로 반복해 빛과 색의 순간을 포착했습니다. 《수련》《루앙 대성당》 연작이 유명합니다.",
    },
    "Edgar Degas": {
        "life": "1834–1917",
        "description": "발레리나·경마·카페 풍경을 비정형 구도로 그린 인상주의 화가. 인체의 움직임과 일상의 순간을 날카롭게 관찰했습니다.",
    },
    "Pierre-Auguste Renoir": {
        "life": "1841–1919",
        "description": "따뜻한 색채와 부드러운 붓터치로 인물과 야외의 즐거움을 그린 인상주의 화가. 빛이 피부에 스며드는 느낌이 특징입니다.",
    },
    "Camille Pissarro": {
        "life": "1830–1903",
        "description": "인상주의의 기여자이자 후기 인상주의로 이어지는 화가. 농촌과 도시 풍경을 꾸준히 그리며 색의 조화를 탐구했습니다.",
    },
    "Mary Cassatt": {
        "life": "1844–1926",
        "description": "프랑스 인상주의에 참여한 미국 화가. 어머니와 아이, 여성의 일상을 따뜻하고 섬세하게 그렸습니다.",
    },
    "Vincent van Gogh": {
        "life": "1853–1890",
        "description": "강렬한 색과 소용돌이치는 붓질로 내면의 열정을 표현한 화가. 《해바라기》《별이 빛나는 밤》 등이 대표작입니다.",
    },
    "Paul Cézanne": {
        "life": "1839–1906",
        "description": "정물과 풍경을 기하학적 형태로 재구성한 화가. 인상주의를 넘어 입체주의와 현대 미술의 토대를 마련했습니다.",
    },
    "Paul Gauguin": {
        "life": "1848–1903",
        "description": "타히티 등 열대의 풍경과 원주민 생활을 평면적 색면과 상징으로 그린 후기 인상주의 화가. 색의 상징성을 강조했습니다.",
    },
    "Henri Matisse": {
        "life": "1869–1954",
        "description": "대담한 색채와 장식적인 구도로 현대 회화를 이끈 화가. ‘색채와 선의 화가’로 불리며 야수파의 대표 주자입니다.",
    },
    "Pablo Picasso": {
        "life": "1881–1973",
        "description": "20세기 미술을 바꾼 스페인 출신 화가. 입체주의를 개척하고 형태를 해체·재조합하며 《게르니카》 등 수많은 혁신을 남겼습니다.",
    },
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


def _artist_sample_works(name: str, object_ids: list[int], limit: int = 3) -> list[dict[str, Any]]:
    if not object_ids:
        return []
    works = _apply_korean_descriptions(_fetch_met_works_from_ids(object_ids, limit=limit))
    return [
        {
            "id": w.get("id"),
            "title": w.get("title") or "Untitled",
            "date": w.get("date") or "",
            "thumb_url": w.get("thumb_url"),
            "image_url": w.get("image_url"),
            "direct_thumb_url": w.get("direct_thumb_url"),
            "direct_image_url": w.get("direct_image_url"),
        }
        for w in works[:limit]
    ]


def _artist_card(name: str, era: dict[str, Any]) -> dict[str, Any]:
    search_name = _artist_search_name(name)
    ids, total = _met_search(search_name, artist=True, max_ids=12)
    portrait = _artist_portrait(name)
    info = ARTIST_INFO.get(name) or ARTIST_INFO.get(search_name) or {}
    life = info.get("life", "")
    description = info.get("description") or f"{name}은(는) {era['label']} 시기를 대표하는 화가입니다."
    sample_works = _artist_sample_works(name, ids, limit=3)

    return {
        "name": name,
        "era_id": era["id"],
        "era_label": era["label"],
        "period": era.get("period") or "",
        "life": life,
        "description": description,
        "preview_url": portrait.get("preview_url"),
        "thumb_url": portrait.get("thumb_url"),
        "image_url": portrait.get("image_url"),
        "lqip": "",
        "sample_count": total,
        "sample_works": sample_works,
    }


def fetch_eras_artists() -> list[dict[str, Any]]:
    cache_key = "eras:met:v2:ko"
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
