"""Tour page — fetch travel images from Unsplash, Pexels, Pixabay + Wikipedia descriptions."""

from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from typing import Any

from tour_places import TOUR_CATEGORIES, kst_today, pick_all_categories_for_date, place_meta
from tour_store import load_tour_edition, save_tour_edition, tour_store_configured

TOUR_UA = "DigitalWorld-Tour/1.0 (educational; github.com/Jongkyung-Ko/First)"
UNSPLASH_API = "https://api.unsplash.com"
PEXELS_API = "https://api.pexels.com/v1"
PIXABAY_API = "https://pixabay.com/api/"
WIKI_API = "https://en.wikipedia.org/api/rest_v1/page/summary"

GALLERY_SIZE = 10
MIN_IMAGES = GALLERY_SIZE + 1

# Landmark keyword in alt/tags → place must match one of these tokens (city/country).
_LANDMARK_RULES: list[tuple[str, frozenset[str]]] = [
    ("eiffel", frozenset({"paris", "france", "파리", "프랑스", "colmar"})),
    ("colosseum", frozenset({"rome", "italy", "로마", "이탈리아", "pompeii", "폼페이"})),
    ("big ben", frozenset({"london", "united kingdom", "런던", "영국", "westminster"})),
    ("tower bridge", frozenset({"london", "united kingdom", "런던", "영국"})),
    ("london eye", frozenset({"london", "united kingdom", "런던", "영국"})),
    ("buckingham", frozenset({"london", "united kingdom", "런던", "영국"})),
    ("statue of liberty", frozenset({"new york", "united states", "뉴욕", "미국", "manhattan"})),
    ("taj mahal", frozenset({"india", "agra", "인도"})),
    ("sagrada familia", frozenset({"barcelona", "spain", "바르셀로나", "스페인"})),
    ("christ the redeemer", frozenset({"rio", "brazil", "리우", "브라질"})),
    ("burj khalifa", frozenset({"dubai", "emirates", "두바이"})),
    ("opera house", frozenset({"sydney", "australia", "시드니", "호주"})),
    ("golden gate", frozenset({"san francisco", "california", "샌프란시스코"})),
    ("machu picchu", frozenset({"peru", "cusco", "machu", "페루", "쿠스코"})),
    ("parthenon", frozenset({"athens", "greece", "아테네", "그리스"})),
    ("hagia sophia", frozenset({"istanbul", "turkey", "이스탄불", "튀르키예"})),
    ("moai", frozenset({"easter", "rapa nui", "chile", "이스터"})),
    ("dragon blood", frozenset({"socotra", "yemen", "소코트라", "예멘"})),
]

_SOUVENIR_WORDS = frozenset({"miniature", "souvenir", "model", "replica", "figurine", "toy", "snow globe", "keychain"})


def _unsplash_key() -> str:
    key = (os.environ.get("UNSPLASH_ACCESS_KEY") or os.environ.get("UNSPLASH_KEY") or "").strip()
    if not key:
        raise ValueError("UNSPLASH_ACCESS_KEY 환경변수가 설정되지 않았습니다.")
    return key


def _pexels_key() -> str:
    key = (os.environ.get("PEXELS_API_KEY") or os.environ.get("PEXELS_KEY") or "").strip()
    if not key:
        raise ValueError("PEXELS_API_KEY 환경변수가 설정되지 않았습니다.")
    return key


def _pixabay_key() -> str:
    key = (os.environ.get("PIXABAY_API_KEY") or os.environ.get("PIXABAY_KEY") or "").strip()
    if not key:
        raise ValueError("PIXABAY_API_KEY 환경변수가 설정되지 않았습니다.")
    return key


def _fetch_json(url: str, *, headers: dict[str, str] | None = None, timeout: int = 30) -> Any:
    req_headers = {"User-Agent": TOUR_UA, "Accept": "application/json"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def _translate_ko(text: str) -> str:
    clean = (text or "").strip()
    if not clean:
        return clean
    try:
        from space_service import _translate_ko as translate

        return translate(clean)
    except Exception:
        return clean


def _image_score(item: dict[str, Any]) -> float:
    width = int(item.get("width") or 0)
    height = int(item.get("height") or 0)
    if width <= 0 or height <= 0:
        return 0.0
    aspect = width / height
    landscape_bonus = 1.2 if aspect >= 1.2 else 0.8
    return width * height * landscape_bonus


def _normalize_image(
    *,
    url: str,
    thumb_url: str,
    source: str,
    photographer: str,
    credit_url: str,
    width: int,
    height: int,
    provider_id: str = "",
    alt: str = "",
    tags: str = "",
) -> dict[str, Any]:
    return {
        "url": url.strip(),
        "thumb_url": (thumb_url or url).strip(),
        "source": source,
        "photographer": photographer.strip(),
        "credit_url": credit_url.strip(),
        "width": width,
        "height": height,
        "provider_id": str(provider_id or "").strip(),
        "alt": alt.strip(),
        "tags": tags.strip(),
    }


def _search_unsplash(query: str, *, per_page: int = 8) -> list[dict[str, Any]]:
    params = urllib.parse.urlencode(
        {"query": query, "per_page": per_page, "orientation": "landscape", "content_filter": "high"}
    )
    url = f"{UNSPLASH_API}/search/photos?{params}"
    data = _fetch_json(url, headers={"Authorization": f"Client-ID {_unsplash_key()}"})
    results = data.get("results") or []
    out: list[dict[str, Any]] = []
    for hit in results:
        if not isinstance(hit, dict):
            continue
        urls = hit.get("urls") or {}
        user = hit.get("user") or {}
        image_url = str(urls.get("regular") or urls.get("full") or "").strip()
        if not image_url:
            continue
        out.append(
            _normalize_image(
                url=image_url,
                thumb_url=str(urls.get("small") or urls.get("thumb") or image_url),
                source="unsplash",
                photographer=str(user.get("name") or "Unsplash"),
                credit_url=str((hit.get("links") or {}).get("html") or "https://unsplash.com"),
                width=int(hit.get("width") or 0),
                height=int(hit.get("height") or 0),
                provider_id=str(hit.get("id") or ""),
                alt=str(hit.get("alt_description") or hit.get("description") or ""),
            )
        )
    return out


def _search_pexels(query: str, *, per_page: int = 8) -> list[dict[str, Any]]:
    params = urllib.parse.urlencode({"query": query, "per_page": per_page, "orientation": "landscape"})
    url = f"{PEXELS_API}/search?{params}"
    data = _fetch_json(url, headers={"Authorization": _pexels_key()})
    photos = data.get("photos") or []
    out: list[dict[str, Any]] = []
    for hit in photos:
        if not isinstance(hit, dict):
            continue
        src = hit.get("src") or {}
        image_url = str(src.get("large") or src.get("original") or "").strip()
        if not image_url:
            continue
        out.append(
            _normalize_image(
                url=image_url,
                thumb_url=str(src.get("medium") or src.get("small") or image_url),
                source="pexels",
                photographer=str(hit.get("photographer") or "Pexels"),
                credit_url=str(hit.get("url") or "https://www.pexels.com"),
                width=int(hit.get("width") or 0),
                height=int(hit.get("height") or 0),
                provider_id=str(hit.get("id") or ""),
                alt=str(hit.get("alt") or ""),
            )
        )
    return out


def _search_pixabay(query: str, *, per_page: int = 8) -> list[dict[str, Any]]:
    params = {
        "key": _pixabay_key(),
        "q": query,
        "image_type": "photo",
        "orientation": "horizontal",
        "safesearch": "true",
        "per_page": str(per_page),
        "lang": "en",
    }
    url = f"{PIXABAY_API}?{urllib.parse.urlencode(params)}"
    data = _fetch_json(url)
    hits = data.get("hits") or []
    out: list[dict[str, Any]] = []
    for hit in hits:
        if not isinstance(hit, dict):
            continue
        image_url = str(hit.get("largeImageURL") or hit.get("webformatURL") or "").strip()
        if not image_url:
            continue
        out.append(
            _normalize_image(
                url=image_url,
                thumb_url=str(hit.get("webformatURL") or hit.get("previewURL") or image_url),
                source="pixabay",
                photographer=str(hit.get("user") or "Pixabay"),
                credit_url=str(hit.get("pageURL") or "https://pixabay.com"),
                width=int(hit.get("imageWidth") or 0),
                height=int(hit.get("imageHeight") or 0),
                provider_id=str(hit.get("id") or ""),
                tags=str(hit.get("tags") or ""),
            )
        )
    return out


def _image_fingerprint(item: dict[str, Any]) -> str:
    provider_id = str(item.get("provider_id") or "").strip()
    source = str(item.get("source") or "").strip()
    if provider_id and source:
        return f"{source}:{provider_id}"

    for url_key in ("url", "thumb_url"):
        url = re.sub(r"\?.*$", "", str(item.get(url_key) or "").strip())
        if not url:
            continue
        unsplash = re.search(r"/photo-(\d+-[\da-f]+)", url, re.I)
        if unsplash:
            return f"unsplash:{unsplash.group(1).lower()}"
        pexels = re.search(r"pexels\.com/photos/(\d+)", url, re.I)
        if pexels:
            return f"pexels:{pexels.group(1)}"
        pixabay = re.search(r"pixabay\.com/.+/(\d+)/", url, re.I)
        if pixabay:
            return f"pixabay:{pixabay.group(1)}"
        if url:
            return url.lower()
    return ""


def _dedupe_images(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for item in items:
        fp = _image_fingerprint(item)
        if not fp or fp in seen:
            continue
        seen.add(fp)
        out.append(item)
    return out


def _place_text_blob(place: dict[str, str]) -> str:
    parts = [
        place.get("city") or "",
        place.get("country") or "",
        place.get("city_ko") or "",
        place.get("country_ko") or "",
        place.get("continent") or "",
        place.get("search_query") or "",
    ]
    return " ".join(parts).lower()


def _place_tokens(place: dict[str, str]) -> set[str]:
    tokens: set[str] = set()
    for part in _place_text_blob(place).replace(",", " ").split():
        cleaned = re.sub(r"[^a-z0-9가-힣]+", "", part.lower())
        if len(cleaned) >= 3:
            tokens.add(cleaned)
    slug = str(place.get("slug") or "")
    if slug:
        for bit in slug.split("-"):
            if len(bit) >= 3:
                tokens.add(bit.lower())
    return tokens


def _landmark_allowed(place: dict[str, str], allowed: frozenset[str]) -> bool:
    blob = _place_text_blob(place)
    return any(token in blob for token in allowed)


def _image_text(item: dict[str, Any]) -> str:
    return " ".join(
        [
            str(item.get("alt") or ""),
            str(item.get("tags") or ""),
        ]
    ).lower()


def _is_irrelevant(item: dict[str, Any], place: dict[str, str]) -> bool:
    text = _image_text(item)
    if not text:
        return False

    for keyword, allowed in _LANDMARK_RULES:
        if keyword in text and not _landmark_allowed(place, allowed):
            return True

    if any(word in text for word in _SOUVENIR_WORDS):
        for keyword, allowed in _LANDMARK_RULES:
            if keyword in text and not _landmark_allowed(place, allowed):
                return True
    return False


def _relevance_rank(item: dict[str, Any], place: dict[str, str]) -> float:
    if _is_irrelevant(item, place):
        return -1000.0

    text = _image_text(item)
    score = 0.0
    city = str(place.get("city") or "").lower()
    country = str(place.get("country") or "").lower()

    if city and city in text:
        score += 40.0
    if country and country in text:
        score += 20.0
    for token in _place_tokens(place):
        if len(token) >= 4 and token in text:
            score += 8.0
    if any(word in text for word in ("landscape", "travel", "skyline", "cityscape", "aerial")):
        score += 3.0
    return score


def _rank_images(items: list[dict[str, Any]], place: dict[str, str]) -> list[dict[str, Any]]:
    relevant = [item for item in items if not _is_irrelevant(item, place)]
    pool = relevant if len(relevant) >= MIN_IMAGES // 2 else items
    pool = _dedupe_images(pool)
    pool.sort(
        key=lambda item: (_relevance_rank(item, place), _image_score(item)),
        reverse=True,
    )
    return pool


def _select_unique_images(
    images: list[dict[str, Any]],
    *,
    limit: int,
    exclude: set[str] | None = None,
) -> list[dict[str, Any]]:
    seen = set(exclude or ())
    picked: list[dict[str, Any]] = []
    for item in images:
        fp = _image_fingerprint(item)
        if not fp or fp in seen:
            continue
        seen.add(fp)
        picked.append(item)
        if len(picked) >= limit:
            break
    return picked


def _search_queries(place: dict[str, str]) -> list[str]:
    city = place["city"]
    country = place.get("country", "")
    slug = place.get("slug", "")
    base = place.get("search_query") or f"{city} travel landscape"
    queries = [base]

    if slug == "london-uk":
        queries.extend(
            [
                "Tower Bridge London England",
                "London Thames skyline travel",
                "Westminster London travel landscape",
                "London Eye skyline travel",
            ]
        )
    elif slug == "svalbard-no":
        queries.extend(
            [
                "Longyearbyen Svalbard arctic tundra",
                "Svalbard glacier polar landscape",
                "Svalbard Norway arctic winter",
            ]
        )
    else:
        queries.extend(
            [
                f"{city} landmark travel",
                f"{city} skyline travel",
                f"{country} {city} tourism".strip(),
            ]
        )

    seen: set[str] = set()
    out: list[str] = []
    for query in queries:
        key = query.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(query.strip())
    return out


def _collect_images(place: dict[str, str]) -> list[dict[str, Any]]:
    collected: list[dict[str, Any]] = []
    for query in _search_queries(place):
        if len(collected) >= MIN_IMAGES + 4:
            break
        tasks = {
            "unsplash": lambda q=query: _search_unsplash(q),
            "pexels": lambda q=query: _search_pexels(q),
            "pixabay": lambda q=query: _search_pixabay(q),
        }
        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = {pool.submit(fn): name for name, fn in tasks.items()}
            for fut in as_completed(futures):
                try:
                    collected.extend(fut.result())
                except Exception:
                    pass
        collected = _dedupe_images(collected)
    return _rank_images(collected, place)


def _fetch_wikipedia_description(city: str, country: str) -> str:
    titles = [city, f"{city}, {country}"]
    for title in titles:
        encoded = urllib.parse.quote(title.replace(" ", "_"))
        url = f"{WIKI_API}/{encoded}"
        try:
            data = _fetch_json(url, timeout=20)
        except Exception:
            continue
        extract = str(data.get("extract") or "").strip()
        if extract and "may refer to:" not in extract.lower():
            return _translate_ko(extract)
    fallback = f"{city}는(은) {country}의 대표적인 여행지로, 아름다운 풍경과 독특한 문화를 경험할 수 있는 인기 관광 명소입니다."
    return fallback


def _build_place_payload(place: dict[str, str]) -> dict[str, Any]:
    images = _collect_images(place)
    if len(images) < 1:
        raise ValueError(f"{place['city']} 이미지를 충분히 수집하지 못했습니다.")

    hero = images[0]
    hero_fp = _image_fingerprint(hero)
    gallery = _select_unique_images(
        images[1:],
        limit=GALLERY_SIZE,
        exclude={hero_fp} if hero_fp else None,
    )

    payload = place_meta(place)
    payload["description"] = _fetch_wikipedia_description(place["city"], place["country"])
    payload["hero"] = hero
    payload["gallery"] = gallery
    return payload


def _edition_is_complete(existing: dict[str, Any] | None) -> bool:
    if not existing:
        return False
    raw = existing.get("places") or []
    if not isinstance(raw, list) or not raw:
        return False
    # Legacy flat list of places (pre-category format)
    if raw[0].get("hero"):
        return False
    if len(raw) < len(TOUR_CATEGORIES):
        return False
    for cat in raw:
        places = cat.get("places") or []
        if len(places) < 5:
            return False
        if not places[0].get("hero"):
            return False
    return True


def build_tour_edition(edition_date: date | None = None) -> dict[str, Any]:
    target = edition_date or kst_today()
    category_meta = pick_all_categories_for_date(target, n=5)
    built_categories: list[dict[str, Any]] = []
    place_count = 0
    image_count = 0

    for cat in category_meta:
        built_places: list[dict[str, Any]] = []
        for place in cat["places"]:
            built_places.append(_build_place_payload(place))
            place_count += 1
            image_count += 1 + len(built_places[-1].get("gallery") or [])

        built_categories.append(
            {
                "id": cat["id"],
                "title": cat["title"],
                "title_ko": cat["title_ko"],
                "places": built_places,
            }
        )

    return {
        "edition_date": target.isoformat(),
        "title": "Tour Daily",
        "categories": built_categories,
        "place_count": place_count,
        "category_count": len(built_categories),
        "image_count": image_count,
    }


def refresh_tour_edition(*, force: bool = False, edition_date: date | None = None) -> dict[str, Any]:
    """Rebuild daily edition (5 categories × 5 places). Legacy flat rows are always rebuilt."""
    target = edition_date or kst_today()
    if not tour_store_configured():
        raise ValueError("Supabase service role가 설정되지 않았습니다.")

    if not force:
        existing = load_tour_edition(target)
        if _edition_is_complete(existing):
            cats = existing.get("places") or []
            total_places = sum(len(c.get("places") or []) for c in cats if isinstance(c, dict))
            return {
                "skipped": True,
                "edition_date": target.isoformat(),
                "category_count": len(cats),
                "place_count": total_places,
                "refreshed_at": existing.get("refreshed_at"),
                "message": "Already refreshed for this date",
            }

    payload = build_tour_edition(target)
    from tour_cache import cache_edition_images

    cached_categories = cache_edition_images(payload["edition_date"], payload["categories"])
    ok = save_tour_edition(target, cached_categories, title=payload["title"])
    if not ok:
        raise RuntimeError("Failed to save tour edition to Supabase")

    saved = load_tour_edition(target) or {}
    return {
        "skipped": False,
        "edition_date": target.isoformat(),
        "category_count": payload["category_count"],
        "place_count": payload["place_count"],
        "image_count": payload["image_count"],
        "images_cached": True,
        "refreshed_at": saved.get("refreshed_at"),
    }
