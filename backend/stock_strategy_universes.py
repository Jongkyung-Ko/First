"""Stock strategy scan universes — 시가총액 TOP 100 per market."""

from __future__ import annotations

from typing import Any
from zoneinfo import ZoneInfo

from kr_market_universes import KOSDAQ_TOP_100, KOSPI_TOP_100
from us_market_universes import NASDAQ_TOP_100, NYSE_TOP_100

from recommend2_bottom_accumulation import ET, KST
from stock_picks_universe import STOCK_PICKS_UNIVERSE_LIMIT

UNIVERSE_LIMIT = STOCK_PICKS_UNIVERSE_LIMIT
RECENT_DAYS = 14
SCHEDULED_UPDATE_HOUR = 18

KR_UPDATE_SCHEDULE = "매일 18:00 (KST) · 장 마감(15:30) 후 분석"
US_UPDATE_SCHEDULE = "매일 18:00 (뉴욕 ET) · 장 마감(16:00 ET) 후 분석"
GLOBAL_UPDATE_SCHEDULE = (
    "KOSPI·KOSDAQ 18:00 KST · NASDAQ·NYSE 18:00 뉴욕(ET) · 갱신 시각은 뉴욕 기준 표시"
)

NY = ET  # America/New_York

KR_MARKET_KEYS = ("kospi", "kosdaq")
US_MARKET_KEYS = ("nasdaq", "nyse")
ALL_MARKET_KEYS = KR_MARKET_KEYS + US_MARKET_KEYS

MARKET_EXCHANGE_LABELS = {
    "kospi": "KOSPI",
    "kosdaq": "KOSDAQ",
    "nasdaq": "NASDAQ",
    "nyse": "NYSE",
}


def _universe_slice(top100: list, limit: int) -> list:
    return top100[:limit]


def market_configs(universe_limit: int | None = None) -> dict[str, dict[str, Any]]:
    limit = universe_limit if universe_limit is not None else UNIVERSE_LIMIT
    return {
        "kospi": {
            "id": "kospi",
            "title": f"KOSPI TOP {limit}",
            "universe": _universe_slice(KOSPI_TOP_100, limit),
            "timezone": KST,
            "updateSchedule": KR_UPDATE_SCHEDULE,
            "recentDays": RECENT_DAYS,
            "includeActive": True,
            "currency": "KRW",
        },
        "kosdaq": {
            "id": "kosdaq",
            "title": f"KOSDAQ TOP {limit}",
            "universe": _universe_slice(KOSDAQ_TOP_100, limit),
            "timezone": KST,
            "updateSchedule": KR_UPDATE_SCHEDULE,
            "recentDays": RECENT_DAYS,
            "includeActive": True,
            "currency": "KRW",
        },
        "nasdaq": {
            "id": "nasdaq",
            "title": f"NASDAQ TOP {limit}",
            "universe": _universe_slice(NASDAQ_TOP_100, limit),
            "timezone": NY,
            "updateSchedule": US_UPDATE_SCHEDULE,
            "recentDays": RECENT_DAYS,
            "includeActive": True,
            "currency": "USD",
        },
        "nyse": {
            "id": "nyse",
            "title": f"NYSE TOP {limit}",
            "universe": _universe_slice(NYSE_TOP_100, limit),
            "timezone": NY,
            "updateSchedule": US_UPDATE_SCHEDULE,
            "recentDays": RECENT_DAYS,
            "includeActive": True,
            "currency": "USD",
        },
    }


def region_market_keys(region: str) -> tuple[str, ...]:
    r = region.strip().lower()
    if r == "kr":
        return KR_MARKET_KEYS
    if r == "us":
        return US_MARKET_KEYS
    if r in ALL_MARKET_KEYS:
        return (r,)
    return ALL_MARKET_KEYS
