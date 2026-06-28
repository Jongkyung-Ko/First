"""External joke / fun content APIs for the JOKE page."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from deep_translator import GoogleTranslator

JOKE_UA = "DigitalWorld-JOKE/1.0 (educational; github.com/Jongkyung-Ko/First)"
KST = ZoneInfo("Asia/Seoul")
_KO_CACHE: dict[str, str] = {}

EXCUSE_URLS = (
    "https://corporatebs-generator.same-origin.com/client",
    "https://corporatebs-generator.sameerkumar.website/",
)

QUOTE_URLS = (
    "https://animechan.xyz/api/random",
    "https://animechan.vercel.app/api/random",
    "https://api.animechan.io/v1/quotes/random",
)

AZTRO_URL = "https://aztro.sameerkumar.website/"
VEDIKA_HOROSCOPE_URL = "https://api.vedika.io/sandbox/horoscope/{sign}"
OHMANDA_HOROSCOPE_URL = "https://ohmanda.com/api/horoscope/{sign}/"
FREE_HOROSCOPE_URL = "https://freehoroscopeapi.com/api/v1/get-horoscope/daily?sign={sign}"

ZODIAC_SIGNS: list[dict[str, str]] = [
    {"id": "aries", "label": "양자리", "range": "3/21–4/19"},
    {"id": "taurus", "label": "황소자리", "range": "4/20–5/20"},
    {"id": "gemini", "label": "쌍둥이자리", "range": "5/21–6/20"},
    {"id": "cancer", "label": "게자리", "range": "6/21–7/22"},
    {"id": "leo", "label": "사자자리", "range": "7/23–8/22"},
    {"id": "virgo", "label": "처녀자리", "range": "8/23–9/22"},
    {"id": "libra", "label": "천칭자리", "range": "9/23–10/22"},
    {"id": "scorpio", "label": "전갈자리", "range": "10/23–11/21"},
    {"id": "sagittarius", "label": "사수자리", "range": "11/22–12/21"},
    {"id": "capricorn", "label": "염소자리", "range": "12/22–1/19"},
    {"id": "aquarius", "label": "물병자리", "range": "1/20–2/18"},
    {"id": "pisces", "label": "물고기자리", "range": "2/19–3/20"},
]

SEOUL_LAT = 37.5665
SEOUL_LON = 126.9780


def _korea_now() -> datetime:
    return datetime.now(KST)


def _korea_today_iso() -> str:
    return _korea_now().date().isoformat()


def _korea_today_label() -> str:
    dt = _korea_now()
    weekdays = ("월", "화", "수", "목", "금", "토", "일")
    return f"{dt.strftime('%Y-%m-%d')} ({weekdays[dt.weekday()]}) KST"


def _fetch_json(url: str, *, timeout: int = 25, method: str = "GET", data: dict | None = None) -> Any:
    body = None
    headers = {"User-Agent": JOKE_UA, "Accept": "application/json"}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _fetch_many(fetch_one, count: int = 3) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    errors: list[str] = []
    with ThreadPoolExecutor(max_workers=min(count, 4)) as pool:
        futures = [pool.submit(fetch_one) for _ in range(count)]
        for future in as_completed(futures):
            try:
                item = future.result()
                if item:
                    results.append(item)
            except Exception as exc:
                errors.append(str(exc))
    if not results and errors:
        raise RuntimeError(errors[0])
    return results


def _translate_ko(text: str) -> str:
    clean = (text or "").strip()
    if not clean:
        return ""
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


def _apply_bilingual_field(item: dict[str, Any], field: str) -> None:
    original = str(item.get(field) or "").strip()
    if not original:
        return
    item[f"{field}_en"] = original
    item[f"{field}_ko"] = _translate_ko(original)


def _apply_bilingual_items(items: list[dict[str, Any]], field: str) -> list[dict[str, Any]]:
    if not items:
        return items
    with ThreadPoolExecutor(max_workers=min(len(items), 4)) as pool:
        futures = [pool.submit(_apply_bilingual_field, item, field) for item in items]
        for future in as_completed(futures):
            future.result()
    return items


def _fetch_useless_fact() -> dict[str, Any]:
    data = _fetch_json("https://uselessfacts.jsph.pl/api/v2/facts/random")
    text = str(data.get("text") or "").strip()
    if not text:
        raise ValueError("Empty useless fact")
    return {
        "text": text,
        "source": str(data.get("source") or ""),
        "language": str(data.get("language") or ""),
    }


def fetch_useless_facts(count: int = 3) -> dict[str, Any]:
    items = _fetch_many(_fetch_useless_fact, count=count)
    _apply_bilingual_items(items, "text")
    return {"kind": "facts", "count": len(items), "items": items}


def _fetch_excuse() -> dict[str, Any]:
    last_error: Exception | None = None
    for url in EXCUSE_URLS:
        try:
            data = _fetch_json(url)
            phrase = str(data.get("phrase") or data.get("text") or data.get("message") or "").strip()
            if not phrase and isinstance(data, dict):
                phrase = next(
                    (str(v).strip() for k, v in data.items() if isinstance(v, str) and len(v) > 8),
                    "",
                )
            if phrase:
                return {"phrase": phrase}
        except Exception as exc:
            last_error = exc
    raise RuntimeError(str(last_error or "Excuse API unavailable"))


def fetch_excuses(count: int = 3) -> dict[str, Any]:
    items = _fetch_many(_fetch_excuse, count=count)
    _apply_bilingual_items(items, "phrase")
    return {"kind": "excuses", "count": len(items), "items": items}


def _normalize_quote(data: dict[str, Any]) -> dict[str, Any]:
    quote = str(data.get("quote") or data.get("content") or data.get("text") or "").strip()
    anime = str(data.get("anime") or data.get("anime_title") or data.get("show") or "").strip()
    character = str(data.get("character") or data.get("character_name") or "").strip()
    if not quote:
        raise ValueError("Empty quote")
    return {"quote": quote, "anime": anime, "character": character}


def _fetch_quote() -> dict[str, Any]:
    last_error: Exception | None = None
    for url in QUOTE_URLS:
        try:
            data = _fetch_json(url)
            if isinstance(data, list) and data:
                data = data[0]
            if isinstance(data, dict):
                if "data" in data and isinstance(data["data"], dict):
                    data = data["data"]
                return _normalize_quote(data)
        except Exception as exc:
            last_error = exc
    raise RuntimeError(str(last_error or "Quote API unavailable"))


def fetch_quotes(count: int = 3) -> dict[str, Any]:
    items = _fetch_many(_fetch_quote, count=count)
    _apply_bilingual_items(items, "quote")
    return {"kind": "quotes", "count": len(items), "items": items}


def _fetch_programming_joke() -> dict[str, Any]:
    data = _fetch_json("https://v2.jokeapi.dev/joke/Programming?type=single&safe-mode")
    if data.get("error"):
        raise RuntimeError(str(data.get("message") or "Joke API error"))
    joke = str(data.get("joke") or "").strip()
    if not joke and isinstance(data.get("setup"), str):
        joke = f"{data['setup']} {data.get('delivery', '')}".strip()
    if not joke:
        raise ValueError("Empty joke")
    return {"joke": joke, "category": str(data.get("category") or "Programming")}


def fetch_jokes(count: int = 3) -> dict[str, Any]:
    items = _fetch_many(_fetch_programming_joke, count=count)
    _apply_bilingual_items(items, "joke")
    return {"kind": "jokes", "count": len(items), "items": items}


def _zodiac_meta(sign_id: str) -> dict[str, str]:
    meta = next((s for s in ZODIAC_SIGNS if s["id"] == sign_id), None)
    if not meta:
        raise ValueError(f"Unknown sign: {sign_id}")
    return meta


def _horoscope_item(
    sign_id: str,
    meta: dict[str, str],
    *,
    description: str,
    current_date: str = "",
    compatibility: str = "",
    mood: str = "",
    color: str = "",
    lucky_number: str = "",
    lucky_time: str = "",
) -> dict[str, Any]:
    text = description.strip()
    if not text:
        raise ValueError("Empty horoscope")
    return {
        "sign": sign_id,
        "label": meta["label"],
        "range": meta["range"],
        "current_date": current_date,
        "description": text,
        "compatibility": compatibility.strip(),
        "mood": mood.strip(),
        "color": color.strip(),
        "lucky_number": str(lucky_number or "").strip(),
        "lucky_time": lucky_time.strip(),
    }


def _fetch_horoscope_vedika(sign_id: str, meta: dict[str, str]) -> dict[str, Any]:
    url = VEDIKA_HOROSCOPE_URL.format(sign=urllib.parse.quote(sign_id))
    data = _fetch_json(url, timeout=25)
    payload = data.get("data") or {}
    return _horoscope_item(
        sign_id,
        meta,
        description=str(payload.get("prediction") or ""),
        current_date=str(payload.get("date") or ""),
        compatibility=str(payload.get("compatibility") or ""),
        mood=str(payload.get("mood") or ""),
        color=str(payload.get("lucky_color") or ""),
        lucky_number=str(payload.get("lucky_number") or ""),
    )


def _fetch_horoscope_aztro(sign_id: str, meta: dict[str, str]) -> dict[str, Any]:
    url = f"{AZTRO_URL}?sign={urllib.parse.quote(sign_id)}&day=today"
    data = _fetch_json(url, method="POST", timeout=30)
    return _horoscope_item(
        sign_id,
        meta,
        description=str(data.get("description") or ""),
        current_date=str(data.get("current_date") or ""),
        compatibility=str(data.get("compatibility") or ""),
        mood=str(data.get("mood") or ""),
        color=str(data.get("color") or ""),
        lucky_number=str(data.get("lucky_number") or ""),
        lucky_time=str(data.get("lucky_time") or ""),
    )


def _fetch_horoscope_ohmanda(sign_id: str, meta: dict[str, str]) -> dict[str, Any]:
    url = OHMANDA_HOROSCOPE_URL.format(sign=urllib.parse.quote(sign_id))
    data = _fetch_json(url, timeout=20)
    return _horoscope_item(
        sign_id,
        meta,
        description=str(data.get("horoscope") or ""),
        current_date=str(data.get("date") or ""),
    )


def _fetch_horoscope_freeapi(sign_id: str, meta: dict[str, str]) -> dict[str, Any]:
    url = FREE_HOROSCOPE_URL.format(sign=urllib.parse.quote(sign_id))
    data = _fetch_json(url, timeout=20)
    payload = data.get("data") or {}
    return _horoscope_item(
        sign_id,
        meta,
        description=str(payload.get("horoscope") or ""),
        current_date=str(payload.get("date") or ""),
    )


def _fetch_aztro_sign(sign_id: str) -> dict[str, Any]:
    meta = _zodiac_meta(sign_id)
    providers = (
        _fetch_horoscope_vedika,
        _fetch_horoscope_aztro,
        _fetch_horoscope_ohmanda,
        _fetch_horoscope_freeapi,
    )
    errors: list[str] = []
    for provider in providers:
        try:
            return provider(sign_id, meta)
        except Exception as exc:
            errors.append(f"{provider.__name__}: {exc}")
    raise RuntimeError("; ".join(errors) or "Horoscope API unavailable")


def fetch_zodiac_horoscopes() -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    errors: list[str] = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(_fetch_aztro_sign, sign["id"]): sign["id"] for sign in ZODIAC_SIGNS}
        for future in as_completed(futures):
            sign_id = futures[future]
            try:
                items.append(future.result())
            except Exception as exc:
                errors.append(f"{sign_id}: {exc}")
    order = {sign["id"]: idx for idx, sign in enumerate(ZODIAC_SIGNS)}
    items.sort(key=lambda row: order.get(row.get("sign", ""), 99))
    if not items:
        raise RuntimeError(errors[0] if errors else "Horoscope API unavailable")
    return {
        "kind": "fortune_zodiac",
        "date_kst": _korea_today_label(),
        "count": len(items),
        "items": items,
        "errors": errors,
    }


def _freeastro_api_key() -> str:
    return (os.environ.get("FREEASTRO_API_KEY") or os.environ.get("ASTRO_API_KEY") or "").strip()


def _extract_personal_blocks(data: dict[str, Any]) -> list[str]:
    blocks: list[str] = []

    def walk(node: Any, depth: int = 0) -> None:
        if depth > 6 or len(blocks) >= 12:
            return
        if isinstance(node, str):
            text = node.strip()
            if len(text) >= 24 and text not in blocks:
                blocks.append(text)
            return
        if isinstance(node, dict):
            for key in ("summary", "headline", "title", "description", "text", "message", "interpretation"):
                val = node.get(key)
                if isinstance(val, str) and len(val.strip()) >= 16:
                    blocks.append(val.strip())
            for val in node.values():
                walk(val, depth + 1)
            return
        if isinstance(node, list):
            for val in node[:20]:
                walk(val, depth + 1)

    walk(data)
    deduped: list[str] = []
    seen: set[str] = set()
    for block in blocks:
        key = block.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(block)
    return deduped[:8]


def fetch_personal_fortune(payload: dict[str, Any]) -> dict[str, Any]:
    api_key = _freeastro_api_key()
    if not api_key:
        raise RuntimeError(
            "FreeAstroAPI key is not configured. Set FREEASTRO_API_KEY on the backend server."
        )

    try:
        year = int(payload.get("year"))
        month = int(payload.get("month"))
        day = int(payload.get("day"))
        hour = int(payload.get("hour"))
        minute = int(payload.get("minute"))
        lat = float(payload.get("lat"))
        lng = float(payload.get("lng"))
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid birth or location fields") from exc

    tz_str = str(payload.get("timezone") or payload.get("tz_str") or "AUTO").strip() or "AUTO"
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise ValueError("Invalid latitude/longitude")

    body = {
        "birth": {
            "year": year,
            "month": month,
            "day": day,
            "hour": hour,
            "minute": minute,
            "lat": lat,
            "lng": lng,
            "tz_str": tz_str,
            "time_known": True,
        },
        "date": _korea_today_iso(),
        "include_interpretation_blocks": True,
    }
    req = urllib.request.Request(
        "https://api.freeastroapi.com/api/v3/horoscope/daily/personal",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "User-Agent": JOKE_UA,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-api-key": api_key,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:240]
        raise RuntimeError(f"FreeAstroAPI error ({exc.code}): {detail}") from exc

    highlights = _extract_personal_blocks(raw)
    return {
        "kind": "fortune_personal",
        "date_kst": _korea_today_label(),
        "birth": {
            "year": year,
            "month": month,
            "day": day,
            "hour": hour,
            "minute": minute,
        },
        "location": {
            "lat": lat,
            "lng": lng,
            "timezone": tz_str,
            "label": str(payload.get("location_label") or ""),
        },
        "highlights": highlights,
        "raw": raw,
    }


def _weather_summary(code: int) -> str:
    mapping = {
        0: "맑음",
        1: "대체로 맑음",
        2: "부분적으로 흐림",
        3: "흐림",
        45: "안개",
        48: "서리 안개",
        51: "가벼운 이슬비",
        53: "이슬비",
        55: "강한 이슬비",
        61: "약한 비",
        63: "비",
        65: "강한 비",
        71: "약한 눈",
        73: "눈",
        75: "강한 눈",
        80: "소나기",
        95: "뇌우",
    }
    return mapping.get(code, "변덕스러운 날씨")


def _format_place_label(row: dict[str, Any]) -> str:
    name = str(row.get("name") or "").strip()
    admin1 = str(row.get("admin1") or "").strip()
    country = str(row.get("country") or "").strip()
    parts = [p for p in (name, admin1, country) if p]
    return ", ".join(parts) if parts else name or "Unknown"


def search_weather_places(query: str, *, limit: int = 8) -> dict[str, Any]:
    q = (query or "").strip()
    if not q:
        return {"kind": "weather_search", "count": 0, "items": []}
    url = (
        "https://geocoding-api.open-meteo.com/v1/search?"
        f"name={urllib.parse.quote(q)}&count={max(1, min(limit, 12))}&language=ko&format=json"
    )
    data = _fetch_json(url, timeout=20)
    items: list[dict[str, Any]] = []
    for row in data.get("results") or []:
        lat = float(row["latitude"])
        lng = float(row["longitude"])
        label = _format_place_label(row)
        items.append(
            {
                "id": f"{lat:.4f}:{lng:.4f}",
                "label": label,
                "lat": lat,
                "lng": lng,
                "country": str(row.get("country") or ""),
                "admin1": str(row.get("admin1") or ""),
            }
        )
    return {"kind": "weather_search", "count": len(items), "items": items}


def _reverse_geocode_label(lat: float, lon: float) -> str:
    url = (
        "https://geocoding-api.open-meteo.com/v1/reverse?"
        f"latitude={lat}&longitude={lon}&language=ko&format=json"
    )
    try:
        data = _fetch_json(url, timeout=15)
        rows = data.get("results") or []
        if rows:
            return _format_place_label(rows[0])
    except Exception:
        pass
    return f"위도 {lat:.2f}, 경도 {lon:.2f}"


def _weather_at_coords(lat: float, lon: float, *, label: str, source: str) -> dict[str, Any]:
    url = (
        "https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}"
        "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m"
        "&timezone=auto"
    )
    data = _fetch_json(url, timeout=20)
    current = data.get("current") or {}
    code = int(current.get("weather_code") or 0)
    timezone = str(data.get("timezone") or "")
    return {
        "kind": "weather",
        "city": label,
        "source": source,
        "latitude": lat,
        "longitude": lon,
        "timezone": timezone,
        "temperature_c": current.get("temperature_2m"),
        "feels_like_c": current.get("apparent_temperature"),
        "humidity_pct": current.get("relative_humidity_2m"),
        "wind_kmh": current.get("wind_speed_10m"),
        "weather_code": code,
        "summary": _weather_summary(code),
        "updated_at": str(current.get("time") or ""),
    }


def fetch_weather_at(
    lat: float | None = None,
    lon: float | None = None,
    *,
    city: str = "Seoul",
) -> dict[str, Any]:
    if lat is not None and lon is not None:
        label = _reverse_geocode_label(lat, lon)
        return _weather_at_coords(lat, lon, label=label, source="device")
    return _weather_at_coords(SEOUL_LAT, SEOUL_LON, label="서울, South Korea", source="default_seoul")


def fetch_joke_kind(kind: str, *, count: int = 3, city: str = "Seoul") -> dict[str, Any]:
    key = (kind or "").strip().lower()
    if key in ("facts", "fact", "useless"):
        return fetch_useless_facts(count=count)
    if key in ("excuses", "excuse", "bs"):
        return fetch_excuses(count=count)
    if key in ("quotes", "quote"):
        return fetch_quotes(count=count)
    if key in ("jokes", "joke"):
        return fetch_jokes(count=count)
    if key in ("fortune", "fortunes", "luck"):
        return fetch_zodiac_horoscopes()
    if key in ("weather",):
        return fetch_weather_at(city=city)
    raise ValueError(f"Unknown joke kind: {kind}")
