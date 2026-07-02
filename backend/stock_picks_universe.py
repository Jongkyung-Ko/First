"""Stock Picks 공통 유니버스·배치 스캔 상수."""

from __future__ import annotations

STOCK_PICKS_UNIVERSE_LIMIT = 100
STOCK_PICKS_FETCH_PERIOD = "6mo"

BATCH_MARKET_KEYS: tuple[str, ...] = ("kospi", "kosdaq", "nasdaq", "nyse")

BATCH_MARKET_LABELS: dict[str, str] = {
    "kospi": "KOSPI",
    "kosdaq": "KOSDAQ",
    "nasdaq": "NASDAQ",
    "nyse": "NYSE",
}
