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
) -> dict[str, Any]:
    return {
        "url": url.strip(),
        "thumb_url": (thumb_url or url).strip(),
        "source": source,
        "photographer": photographer.strip(),
        "credit_url": credit_url.strip(),
        "width": width,
        "height": height,
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
            )
        )
    return out


def _dedupe_images(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for item in items:
        url = str(item.get("url") or "").strip()
        if not url:
            continue
        key = re.sub(r"\?.*$", "", url)
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def _search_queries(place: dict[str, str]) -> list[str]:
    city = place["city"]
    base = place.get("search_query") or f"{city} travel landscape"
    return [
        base,
        f"{city} landmark travel",
        f"{city} skyline travel",
        f"{place.get('country', '')} {city} tourism".strip(),
    ]


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
    collected.sort(key=_image_score, reverse=True)
    return collected


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
    gallery = images[1 : 1 + GALLERY_SIZE]
    while len(gallery) < GALLERY_SIZE and len(images) > len(gallery) + 1:
        for img in images[1:]:
            if img["url"] not in {g["url"] for g in gallery}:
                gallery.append(img)
            if len(gallery) >= GALLERY_SIZE:
                break

    payload = place_meta(place)
    payload["description"] = _fetch_wikipedia_description(place["city"], place["country"])
    payload["hero"] = hero
    payload["gallery"] = gallery[:GALLERY_SIZE]
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
    ok = save_tour_edition(target, payload["categories"], title=payload["title"])
    if not ok:
        raise RuntimeError("Failed to save tour edition to Supabase")

    saved = load_tour_edition(target) or {}
    return {
        "skipped": False,
        "edition_date": target.isoformat(),
        "category_count": payload["category_count"],
        "place_count": payload["place_count"],
        "image_count": payload["image_count"],
        "refreshed_at": saved.get("refreshed_at"),
    }
