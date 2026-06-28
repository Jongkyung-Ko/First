"""External joke / fun content APIs for the JOKE page."""

from __future__ import annotations

import json
import random
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

JOKE_UA = "DigitalWorld-JOKE/1.0 (educational; github.com/Jongkyung-Ko/First)"

EXCUSE_URLS = (
    "https://corporatebs-generator.same-origin.com/client",
    "https://corporatebs-generator.sameerkumar.website/",
)

QUOTE_URLS = (
    "https://animechan.xyz/api/random",
    "https://animechan.vercel.app/api/random",
    "https://api.animechan.io/v1/quotes/random",
)

FORTUNES = [
    "오늘은 작은 선택 하나가 큰 기회로 이어질 수 있는 날입니다.",
    "주변 사람에게 먼저 미소를 건네면 좋은 소식이 따라옵니다.",
    "미뤄 두었던 일을 시작하기에 좋은 타이밍입니다.",
    "예상치 못한 곳에서 도움을 받게 될 수 있습니다.",
    "차분히 한 걸음씩 나아가면 생각보다 빨리 목표에 닿습니다.",
    "새로운 아이디어가 떠오르니 메모해 두면 좋습니다.",
    "오늘은 휴식과 집중의 균형이 행운을 부릅니다.",
    "솔직한 대화가 관계를 한층 돈독하게 만듭니다.",
    "작은 실수는 크게 걱정하지 않아도 괜찮습니다.",
    "저녁 무렵 기분 좋은 소식이 들려올 수 있습니다.",
    "운동이나 산책이 생각 정리에 도움이 됩니다.",
    "오래 기다려 온 답이 서서히 모습을 드러냅니다.",
]

LUCKY_COLORS = ["파랑", "초록", "보라", "노랑", "하양", "주황", "분홍", "청록"]


def _fetch_json(url: str, *, timeout: int = 25) -> Any:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": JOKE_UA, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _fetch_many(kind: str, fetch_one, count: int = 3) -> list[dict[str, Any]]:
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
    items = _fetch_many("fact", _fetch_useless_fact, count=count)
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
    items = _fetch_many("excuse", _fetch_excuse, count=count)
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
    items = _fetch_many("quote", _fetch_quote, count=count)
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
    items = _fetch_many("joke", _fetch_programming_joke, count=count)
    return {"kind": "jokes", "count": len(items), "items": items}


def fetch_fortunes(count: int = 3) -> dict[str, Any]:
    pool = FORTUNES[:]
    random.shuffle(pool)
    items = []
    for text in pool[: max(1, min(count, len(pool)))]:
        items.append(
            {
                "text": text,
                "lucky_number": random.randint(1, 99),
                "lucky_color": random.choice(LUCKY_COLORS),
            }
        )
    return {"kind": "fortune", "count": len(items), "items": items}


def _geocode_city(city: str) -> tuple[float, float, str]:
    query = urllib.parse.quote(city.strip())
    url = (
        "https://geocoding-api.open-meteo.com/v1/search?"
        f"name={query}&count=1&language=ko&format=json"
    )
    data = _fetch_json(url, timeout=20)
    rows = data.get("results") or []
    if not rows:
        raise ValueError(f"City not found: {city}")
    row = rows[0]
    name = str(row.get("name") or city)
    country = str(row.get("country") or "")
    label = f"{name}, {country}" if country else name
    return float(row["latitude"]), float(row["longitude"]), label


def fetch_weather(city: str = "Seoul") -> dict[str, Any]:
    lat, lon, label = _geocode_city(city or "Seoul")
    url = (
        "https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}"
        "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m"
        "&timezone=auto"
    )
    data = _fetch_json(url, timeout=20)
    current = data.get("current") or {}
    code = int(current.get("weather_code") or 0)
    return {
        "kind": "weather",
        "city": label,
        "temperature_c": current.get("temperature_2m"),
        "feels_like_c": current.get("apparent_temperature"),
        "humidity_pct": current.get("relative_humidity_2m"),
        "wind_kmh": current.get("wind_speed_10m"),
        "weather_code": code,
        "summary": _weather_summary(code),
        "updated_at": str(current.get("time") or ""),
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
        return fetch_fortunes(count=count)
    if key in ("weather",):
        return fetch_weather(city=city)
    raise ValueError(f"Unknown joke kind: {kind}")
