"""Fundamentals scan universes — 시가총액 TOP 200 per market."""

from __future__ import annotations

from typing import Any
from zoneinfo import ZoneInfo

from fundamentals_universe_ext import (
    KOSDAQ_EXT_100,
    KOSPI_EXT_100,
    NASDAQ_EXT_100,
    NYSE_EXT_100,
)
from kr_market_universes import KOSDAQ_TOP_100, KOSPI_TOP_100
from recommend2_bottom_accumulation import ET, KST
from us_market_universes import NASDAQ_TOP_100, NYSE_TOP_100

FUNDAMENTALS_UNIVERSE_LIMIT = 200
FUNDAMENTALS_TOP_N = 20
KR_UPDATE_SCHEDULE = "매일 18:00 (KST) · 장 마감(15:30) 후 분석"
US_UPDATE_SCHEDULE = "매일 18:00 (뉴욕 ET) · 장 마감(16:00 ET) 후 분석"
GLOBAL_UPDATE_SCHEDULE = (
    "KOSPI·KOSDAQ·NASDAQ·NYSE 각 TOP 200 → 지표별 TOP 20 · "
    "KOSPI·KOSDAQ 18:00 KST · NASDAQ·NYSE 18:00 뉴욕(ET)"
)

NY = ET
KR_MARKET_KEYS = ("kospi", "kosdaq")
US_MARKET_KEYS = ("nasdaq", "nyse")
ALL_MARKET_KEYS = KR_MARKET_KEYS + US_MARKET_KEYS

MARKET_EXCHANGE_LABELS = {
    "kospi": "KOSPI",
    "kosdaq": "KOSDAQ",
    "nasdaq": "NASDAQ",
    "nyse": "NYSE",
}


def _merge_universe(
    primary: list[tuple[str, str]],
    extra: list[tuple[str, str]],
    limit: int,
) -> list[tuple[str, str]]:
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for ticker, name in primary + extra:
        if ticker in seen:
            continue
        seen.add(ticker)
        out.append((ticker, name))
        if len(out) >= limit:
            break
    return out


def region_market_keys(region: str) -> tuple[str, ...]:
    if region == "kr":
        return KR_MARKET_KEYS
    if region == "us":
        return US_MARKET_KEYS
    if region in ALL_MARKET_KEYS:
        return (region,)
    return ALL_MARKET_KEYS


def market_configs(limit: int | None = None) -> dict[str, dict[str, Any]]:
    cap = limit if limit is not None else FUNDAMENTALS_UNIVERSE_LIMIT
    return {
        "kospi": {
            "id": "kospi",
            "title": f"KOSPI TOP {cap}",
            "universe": _merge_universe(KOSPI_TOP_100, KOSPI_EXT_100, cap),
            "timezone": KST,
            "updateSchedule": KR_UPDATE_SCHEDULE,
            "currency": "KRW",
        },
        "kosdaq": {
            "id": "kosdaq",
            "title": f"KOSDAQ TOP {cap}",
            "universe": _merge_universe(KOSDAQ_TOP_100, KOSDAQ_EXT_100, cap),
            "timezone": KST,
            "updateSchedule": KR_UPDATE_SCHEDULE,
            "currency": "KRW",
        },
        "nasdaq": {
            "id": "nasdaq",
            "title": f"NASDAQ TOP {cap}",
            "universe": _merge_universe(NASDAQ_TOP_100, NASDAQ_EXT_100, cap),
            "timezone": NY,
            "updateSchedule": US_UPDATE_SCHEDULE,
            "currency": "USD",
        },
        "nyse": {
            "id": "nyse",
            "title": f"NYSE TOP {cap}",
            "universe": _merge_universe(NYSE_TOP_100, NYSE_EXT_100, cap),
            "timezone": NY,
            "updateSchedule": US_UPDATE_SCHEDULE,
            "currency": "USD",
        },
    }
