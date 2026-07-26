"""Chart 스냅샷 — KR/US 시세·차트 디스크 저장·조회."""

from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from recommend2_bottom_accumulation import ET, KST

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_KR_SNAPSHOT_PATH = ROOT / "data" / "chart-kr-snapshot.json"
DEFAULT_US_SNAPSHOT_PATH = ROOT / "data" / "chart-us-snapshot.json"

KR_MARKET_KEYS = ("kr_kospi", "kr_kosdaq")
US_MARKET_KEYS = ("nyse", "nasdaq")
ALL_CHART_MARKET_KEYS = KR_MARKET_KEYS + US_MARKET_KEYS
CHART_SNAPSHOT_PERIODS = ("1mo", "3mo", "6mo", "1y", "2y", "5y", "10y")

REGION_CONFIG: dict[str, dict[str, Any]] = {
    "kr": {
        "path": DEFAULT_KR_SNAPSHOT_PATH,
        "market_keys": KR_MARKET_KEYS,
        "update_schedule": "매일 18:00 (KST) · 장 마감(15:30) 후 차트·시세 반영",
        "timezone": "Asia/Seoul",
        "env_path_key": "CHART_KR_SNAPSHOT_PATH",
    },
    "us": {
        "path": DEFAULT_US_SNAPSHOT_PATH,
        "market_keys": US_MARKET_KEYS,
        "update_schedule": "매일 18:00 (ET) · 장 마감(16:00) 후 차트·시세 반영",
        "timezone": "America/New_York",
        "env_path_key": "CHART_US_SNAPSHOT_PATH",
    },
}

_memory_snapshots: dict[str, dict[str, Any]] = {}


def snapshot_path(region: str) -> Path:
    cfg = REGION_CONFIG[region]
    raw = os.getenv(str(cfg["env_path_key"]), "").strip()
    return Path(raw) if raw else cfg["path"]


def region_for_market(market: str) -> str | None:
    if market in KR_MARKET_KEYS:
        return "kr"
    if market in US_MARKET_KEYS:
        return "us"
    return None


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
        return None
    return value


def assemble_payload(
    region: str,
    markets: dict[str, Any],
    *,
    source: str = "snapshot",
    saved_at: str | None = None,
) -> dict[str, Any]:
    cfg = REGION_CONFIG[region]
    now_utc = datetime.now(timezone.utc)
    tz = KST if region == "kr" else ET
    now_local = now_utc.astimezone(tz)
    return _json_safe(
        {
            "version": 1,
            "region": region,
            "source": source,
            "savedAt": saved_at or now_utc.isoformat(),
            "updatedAt": now_utc.isoformat(),
            "updatedAtLocal": now_local.isoformat(),
            "updateSchedule": cfg["update_schedule"],
            "timezone": cfg["timezone"],
            "periods": list(CHART_SNAPSHOT_PERIODS),
            "markets": markets,
        }
    )


def load_snapshot(region: str = "kr", *, refresh: bool = False) -> dict[str, Any] | None:
    if region not in REGION_CONFIG:
        return None
    if not refresh and region in _memory_snapshots:
        return _memory_snapshots[region]

    path = snapshot_path(region)
    from json_io import read_json_file

    data = read_json_file(path)
    if isinstance(data, dict) and data.get("markets"):
        _memory_snapshots[region] = data
        return data
    return None


def save_snapshot(region: str, payload: dict[str, Any]) -> Path:
    path = snapshot_path(region)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(payload)
    payload["source"] = "snapshot"
    payload["savedAt"] = payload.get("savedAt") or datetime.now(timezone.utc).isoformat()

    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    _memory_snapshots[region] = payload
    return path


def _snapshot_age_seconds(payload: dict[str, Any]) -> int:
    saved = payload.get("savedAt") or payload.get("updatedAt")
    if not saved:
        return 0
    try:
        dt = datetime.fromisoformat(str(saved).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return max(0, int(time.time() - dt.timestamp()))
    except ValueError:
        return 0


def get_chart_from_snapshot(ticker: str, period: str) -> dict[str, Any] | None:
    for region in REGION_CONFIG:
        snap = load_snapshot(region)
        if not snap:
            continue
        for market in (snap.get("markets") or {}).values():
            charts = (market.get("charts") or {}).get(ticker)
            if not isinstance(charts, dict):
                continue
            entry = charts.get(period)
            if not isinstance(entry, dict) or not entry.get("candles"):
                continue
            payload = dict(entry)
            payload["cached"] = True
            payload["source"] = "snapshot"
            payload["cacheAgeSeconds"] = _snapshot_age_seconds(snap)
            return _json_safe(payload)
    return None


def get_market_top_from_snapshot(market: str) -> dict[str, Any] | None:
    region = region_for_market(market)
    if not region:
        return None
    snap = load_snapshot(region)
    if not snap:
        return None
    block = (snap.get("markets") or {}).get(market)
    if not isinstance(block, dict) or not block.get("items"):
        return None
    payload = dict(block)
    payload["cached"] = True
    payload["source"] = "snapshot"
    payload["cacheAgeSeconds"] = _snapshot_age_seconds(snap)
    payload["updatedAt"] = snap.get("updatedAt")
    payload["updateSchedule"] = snap.get("updateSchedule")
    payload["region"] = region
    return _json_safe(payload)


def build_market_block(
    market_id: str,
    universe: dict[str, Any],
    fetch_chart: Callable[..., dict[str, Any]],
    fetch_quote: Callable[[str], dict[str, Any]],
    *,
    after_scheduled_update: bool = True,
    max_workers: int = 6,
) -> dict[str, Any]:
    limit = int(universe.get("limit", 30))
    stocks = universe["stocks"][:limit]

    quotes: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        quote_futures = {pool.submit(fetch_quote, ticker): ticker for ticker, _ in stocks}
        for future in as_completed(quote_futures):
            ticker = quote_futures[future]
            try:
                quotes[ticker] = future.result()
            except Exception:
                quotes[ticker] = {"price": None, "changePct": None}

    items: list[dict[str, Any]] = []
    for rank, (ticker, name) in enumerate(stocks, start=1):
        quote = quotes.get(ticker, {"price": None, "changePct": None})
        items.append(
            {
                "rank": rank,
                "ticker": ticker,
                "name": name,
                "price": quote.get("price"),
                "changePct": quote.get("changePct"),
            }
        )

    charts: dict[str, dict[str, Any]] = {ticker: {} for ticker, _ in stocks}

    def fetch_one(ticker: str, period: str) -> tuple[str, str, dict[str, Any] | None]:
        try:
            data = fetch_chart(
                ticker,
                period,
                interval="1d",
                after_scheduled_update=after_scheduled_update,
            )
            return ticker, period, data
        except Exception:
            return ticker, period, None

    tasks = [(ticker, period) for ticker, _ in stocks for period in CHART_SNAPSHOT_PERIODS]
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [pool.submit(fetch_one, ticker, period) for ticker, period in tasks]
        for future in as_completed(futures):
            ticker, period, data = future.result()
            if data and data.get("candles"):
                charts[ticker][period] = {
                    k: v
                    for k, v in data.items()
                    if k in ("ticker", "name", "market", "period", "interval", "count", "candles")
                }

    return {
        "market": market_id,
        "segmentTitle": universe["title"],
        "count": len(items),
        "items": items,
        "charts": charts,
    }


def build_and_save_region_snapshot(
    region: str,
    fetch_chart: Callable[..., dict[str, Any]],
    fetch_quote: Callable[[str], dict[str, Any]],
    market_universes: dict[str, dict[str, Any]],
    *,
    after_scheduled_update: bool = True,
) -> dict[str, Any]:
    if region not in REGION_CONFIG:
        raise ValueError(f"Unknown chart snapshot region: {region}")

    markets: dict[str, Any] = {}
    for market_id in REGION_CONFIG[region]["market_keys"]:
        universe = market_universes[market_id]
        print(f"Building chart snapshot [{region}] {market_id} ({universe.get('limit', 30)} tickers)...")
        markets[market_id] = build_market_block(
            market_id,
            universe,
            fetch_chart,
            fetch_quote,
            after_scheduled_update=after_scheduled_update,
        )

    payload = assemble_payload(region, markets, source="snapshot")
    save_snapshot(region, payload)
    return payload


def build_and_save_kr_snapshot(
    fetch_chart: Callable[..., dict[str, Any]],
    fetch_quote: Callable[[str], dict[str, Any]],
    market_universes: dict[str, dict[str, Any]],
    *,
    after_scheduled_update: bool = True,
) -> dict[str, Any]:
    return build_and_save_region_snapshot(
        "kr",
        fetch_chart,
        fetch_quote,
        market_universes,
        after_scheduled_update=after_scheduled_update,
    )
