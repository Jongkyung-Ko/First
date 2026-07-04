"""Curated world hot-spot pool and daily place selection for Tour page."""

from __future__ import annotations

import random
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")

HOT_PLACES: list[dict[str, str]] = [
    {"slug": "paris-fr", "continent": "Europe", "continent_ko": "유럽", "country": "France", "country_ko": "프랑스", "city": "Paris", "city_ko": "파리", "search_query": "Paris Eiffel Tower travel landscape"},
    {"slug": "rome-it", "continent": "Europe", "continent_ko": "유럽", "country": "Italy", "country_ko": "이탈리아", "city": "Rome", "city_ko": "로마", "search_query": "Rome Colosseum travel landscape"},
    {"slug": "london-uk", "continent": "Europe", "continent_ko": "유럽", "country": "United Kingdom", "country_ko": "영국", "city": "London", "city_ko": "런던", "search_query": "London Big Ben travel landscape"},
    {"slug": "barcelona-es", "continent": "Europe", "continent_ko": "유럽", "country": "Spain", "country_ko": "스페인", "city": "Barcelona", "city_ko": "바르셀로나", "search_query": "Barcelona Sagrada Familia travel"},
    {"slug": "santorini-gr", "continent": "Europe", "continent_ko": "유럽", "country": "Greece", "country_ko": "그리스", "city": "Santorini", "city_ko": "산토리니", "search_query": "Santorini Greece blue domes travel"},
    {"slug": "reykjavik-is", "continent": "Europe", "continent_ko": "유럽", "country": "Iceland", "country_ko": "아이슬란드", "city": "Reykjavik", "city_ko": "레이캬비크", "search_query": "Iceland northern lights landscape travel"},
    {"slug": "tokyo-jp", "continent": "Asia", "continent_ko": "아시아", "country": "Japan", "country_ko": "일본", "city": "Tokyo", "city_ko": "도쿄", "search_query": "Tokyo skyline travel landscape"},
    {"slug": "kyoto-jp", "continent": "Asia", "continent_ko": "아시아", "country": "Japan", "country_ko": "일본", "city": "Kyoto", "city_ko": "교토", "search_query": "Kyoto temple cherry blossom travel"},
    {"slug": "bali-id", "continent": "Asia", "continent_ko": "아시아", "country": "Indonesia", "country_ko": "인도네시아", "city": "Bali", "city_ko": "발리", "search_query": "Bali rice terrace travel landscape"},
    {"slug": "seoul-kr", "continent": "Asia", "continent_ko": "아시아", "country": "South Korea", "country_ko": "대한민국", "city": "Seoul", "city_ko": "서울", "search_query": "Seoul Namsan Tower travel landscape"},
    {"slug": "dubai-ae", "continent": "Asia", "continent_ko": "아시아", "country": "United Arab Emirates", "country_ko": "아랍에미리트", "city": "Dubai", "city_ko": "두바이", "search_query": "Dubai Burj Khalifa travel landscape"},
    {"slug": "singapore-sg", "continent": "Asia", "continent_ko": "아시아", "country": "Singapore", "country_ko": "싱가포르", "city": "Singapore", "city_ko": "싱가포르", "search_query": "Singapore Marina Bay travel landscape"},
    {"slug": "new-york-us", "continent": "North America", "continent_ko": "북아메리카", "country": "United States", "country_ko": "미국", "city": "New York", "city_ko": "뉴욕", "search_query": "New York Manhattan skyline travel"},
    {"slug": "san-francisco-us", "continent": "North America", "continent_ko": "북아메리카", "country": "United States", "country_ko": "미국", "city": "San Francisco", "city_ko": "샌프란시스코", "search_query": "San Francisco Golden Gate Bridge travel"},
    {"slug": "vancouver-ca", "continent": "North America", "continent_ko": "북아메리카", "country": "Canada", "country_ko": "캐나다", "city": "Vancouver", "city_ko": "밴쿠버", "search_query": "Vancouver mountains skyline travel"},
    {"slug": "cancun-mx", "continent": "North America", "continent_ko": "북아메리카", "country": "Mexico", "country_ko": "멕시코", "city": "Cancun", "city_ko": "칸쿤", "search_query": "Cancun beach turquoise travel landscape"},
    {"slug": "rio-br", "continent": "South America", "continent_ko": "남아메리카", "country": "Brazil", "country_ko": "브라질", "city": "Rio de Janeiro", "city_ko": "리우데자네이루", "search_query": "Rio de Janeiro Christ the Redeemer travel"},
    {"slug": "cusco-pe", "continent": "South America", "continent_ko": "남아메리카", "country": "Peru", "country_ko": "페루", "city": "Cusco", "city_ko": "쿠스코", "search_query": "Machu Picchu Peru travel landscape"},
    {"slug": "buenos-aires-ar", "continent": "South America", "continent_ko": "남아메리카", "country": "Argentina", "country_ko": "아르헨티나", "city": "Buenos Aires", "city_ko": "부에노스아이레스", "search_query": "Buenos Aires city travel landscape"},
    {"slug": "patagonia-cl", "continent": "South America", "continent_ko": "남아메리카", "country": "Chile", "country_ko": "칠레", "city": "Patagonia", "city_ko": "파타고니아", "search_query": "Patagonia mountains landscape travel"},
    {"slug": "cairo-eg", "continent": "Africa", "continent_ko": "아프리카", "country": "Egypt", "country_ko": "이집트", "city": "Cairo", "city_ko": "카이로", "search_query": "Pyramids Giza Egypt travel landscape"},
    {"slug": "cape-town-za", "continent": "Africa", "continent_ko": "아프리카", "country": "South Africa", "country_ko": "남아프리카", "city": "Cape Town", "city_ko": "케이프타운", "search_query": "Cape Town Table Mountain travel landscape"},
    {"slug": "marrakech-ma", "continent": "Africa", "continent_ko": "아프리카", "country": "Morocco", "country_ko": "모로코", "city": "Marrakech", "city_ko": "마라케시", "search_query": "Marrakech medina travel landscape"},
    {"slug": "serengeti-tz", "continent": "Africa", "continent_ko": "아프리카", "country": "Tanzania", "country_ko": "탄자니아", "city": "Serengeti", "city_ko": "세렝게티", "search_query": "Serengeti safari landscape travel"},
    {"slug": "sydney-au", "continent": "Oceania", "continent_ko": "오세아니아", "country": "Australia", "country_ko": "호주", "city": "Sydney", "city_ko": "시드니", "search_query": "Sydney Opera House harbour travel"},
    {"slug": "queenstown-nz", "continent": "Oceania", "continent_ko": "오세아니아", "country": "New Zealand", "country_ko": "뉴질랜드", "city": "Queenstown", "city_ko": "퀸스타운", "search_query": "Queenstown New Zealand mountains travel"},
    {"slug": "bora-bora-pf", "continent": "Oceania", "continent_ko": "오세아니아", "country": "French Polynesia", "country_ko": "프랑스령 폴리네시아", "city": "Bora Bora", "city_ko": "보라보라", "search_query": "Bora Bora lagoon overwater travel"},
    {"slug": "istanbul-tr", "continent": "Europe", "continent_ko": "유럽", "country": "Turkey", "country_ko": "튀르키예", "city": "Istanbul", "city_ko": "이스탄불", "search_query": "Istanbul Hagia Sophia travel landscape"},
    {"slug": "prague-cz", "continent": "Europe", "continent_ko": "유럽", "country": "Czech Republic", "country_ko": "체코", "city": "Prague", "city_ko": "프라하", "search_query": "Prague Charles Bridge travel landscape"},
    {"slug": "amsterdam-nl", "continent": "Europe", "continent_ko": "유럽", "country": "Netherlands", "country_ko": "네덜란드", "city": "Amsterdam", "city_ko": "암스테르담", "search_query": "Amsterdam canal travel landscape"},
    {"slug": "hong-kong-hk", "continent": "Asia", "continent_ko": "아시아", "country": "Hong Kong", "country_ko": "홍콩", "city": "Hong Kong", "city_ko": "홍콩", "search_query": "Hong Kong skyline Victoria Harbour travel"},
    {"slug": "mumbai-in", "continent": "Asia", "continent_ko": "아시아", "country": "India", "country_ko": "인도", "city": "Mumbai", "city_ko": "뭄바이", "search_query": "Mumbai Gateway of India travel landscape"},
    {"slug": "los-angeles-us", "continent": "North America", "continent_ko": "북아메리카", "country": "United States", "country_ko": "미국", "city": "Los Angeles", "city_ko": "로스앤젤레스", "search_query": "Los Angeles Hollywood sign travel landscape"},
    {"slug": "havana-cu", "continent": "North America", "continent_ko": "북아메리카", "country": "Cuba", "country_ko": "쿠바", "city": "Havana", "city_ko": "아바나", "search_query": "Havana Cuba old town travel landscape"},
    {"slug": "petra-jo", "continent": "Asia", "continent_ko": "아시아", "country": "Jordan", "country_ko": "요르단", "city": "Petra", "city_ko": "페트라", "search_query": "Petra Jordan treasury travel landscape"},
    {"slug": "maldives-mv", "continent": "Asia", "continent_ko": "아시아", "country": "Maldives", "country_ko": "몰디브", "city": "Maldives", "city_ko": "몰디브", "search_query": "Maldives beach overwater villa travel"},
]

CONTINENT_ORDER = ("Europe", "Asia", "North America", "South America", "Africa", "Oceania")


def kst_today() -> date:
    return datetime.now(KST).date()


def _seed_for_date(d: date) -> int:
    return int(d.strftime("%Y%m%d"))


def pick_places_for_date(d: date | None = None, n: int = 5) -> list[dict[str, str]]:
    """Pick n places with continent diversity using date-seeded shuffle."""
    target = d or kst_today()
    rng = random.Random(_seed_for_date(target))

    by_continent: dict[str, list[dict[str, str]]] = {}
    for place in HOT_PLACES:
        by_continent.setdefault(place["continent"], []).append(place)

    for bucket in by_continent.values():
        rng.shuffle(bucket)

    picked: list[dict[str, str]] = []
    used_slugs: set[str] = set()

    for continent in CONTINENT_ORDER:
        if len(picked) >= n:
            break
        bucket = by_continent.get(continent) or []
        if bucket:
            place = bucket.pop(0)
            picked.append(dict(place))
            used_slugs.add(place["slug"])

    remaining = [p for p in HOT_PLACES if p["slug"] not in used_slugs]
    rng.shuffle(remaining)
    for place in remaining:
        if len(picked) >= n:
            break
        picked.append(dict(place))
        used_slugs.add(place["slug"])

    return picked[:n]


def place_meta(place: dict[str, str]) -> dict[str, Any]:
    return {
        "slug": place["slug"],
        "continent": place["continent"],
        "continent_ko": place["continent_ko"],
        "country": place["country"],
        "country_ko": place["country_ko"],
        "city": place["city"],
        "city_ko": place["city_ko"],
    }
